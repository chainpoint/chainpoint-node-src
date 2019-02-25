/* global describe, it beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')
const fs = require('fs')

const app = require('../lib/api-server.js')
const verify = require('../lib/endpoints/verify.js')
const cpb = require('chainpoint-binary')

describe('Verify Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
    verify.setEventMetrics({
      captureEvent: () => {}
    })
    verify.setENV({
      POST_VERIFY_PROOFS_MAX: 1
    })
    verify.setCores({
      getCachedTransactionAsync: async txId => {
        switch (txId) {
          case '985635': {
            return { dataVal: '4690932f928fb7f7ce6e6c49ee95851742231709360be28b7ce2af7b92cfa95b' }
          }
          case '985814': {
            return { dataVal: 'c617f5faca34474bea7020d75c39cb8427a32145f9646586ecb9184002131ad9' }
          }
          default: {
            return {
              dataVal: ''
            }
          }
        }
      }
    })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('POST /verify', () => {
    it('should return the proper error with bad content type', done => {
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'text/plain')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('Invalid content type')
          done()
        })
    })

    it('should return the proper error with missing proofs property', done => {
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('Invalid JSON body, missing proofs')
          done()
        })
    })

    it('should return the proper error with proofs not an array', done => {
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: 'notarray' })
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('Invalid JSON body, proofs is not an Array')
          done()
        })
    })

    it('should return the proper error with empty proofs array', done => {
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [] })
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('Invalid JSON body, proofs Array is empty')
          done()
        })
    })

    it('should return the proper error with max proofs exceeded', done => {
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: ['p1', 'p2'] })
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal(`Invalid JSON body, proofs Array max size of 1 exceeded`)
          done()
        })
    })

    it('should return successful result with malformed proof', done => {
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: ['p1'] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('malformed')
          done()
        })
    })

    it('should return successful result with invalid cal proof (json)', done => {
      let calProof = JSON.parse(fs.readFileSync('./tests/sample-data/cal-proof.chp.json'))
      calProof.hash = 'badf27222fe366d0b8988b7312c6ba60ee422418d92b62cdcb71fe2991ee7391'
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [calProof] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(1)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[0])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('invalid')
          done()
        })
    })

    it('should return successful result with invalid btc proof (json)', done => {
      let btcProof = JSON.parse(fs.readFileSync('./tests/sample-data/btc-proof.chp.json'))
      btcProof.hash = 'badf27222fe366d0b8988b7312c6ba60ee422418d92b62cdcb71fe2991ee7391'
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [btcProof] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(2)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[0])
          expect(res.body[0].anchors[1]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[1]).length).to.equal(3)
          expect(res.body[0].anchors[1])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('btc_anchor_branch')
          expect(res.body[0].anchors[1])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('btc')
          expect(res.body[0].anchors[1])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[1])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('invalid')
          done()
        })
    })

    it('should return successful result with valid cal proof (json)', done => {
      let calProof = JSON.parse(fs.readFileSync('./tests/sample-data/cal-proof.chp.json'))
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [calProof] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(1)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[0])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('verified')
          done()
        })
    })

    it('should return successful result with valid btc proof (json)', done => {
      let btcProof = JSON.parse(fs.readFileSync('./tests/sample-data/btc-proof.chp.json'))
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [btcProof] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(2)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[0])
          expect(res.body[0].anchors[1]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[1]).length).to.equal(3)
          expect(res.body[0].anchors[1])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('btc_anchor_branch')
          expect(res.body[0].anchors[1])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('btc')
          expect(res.body[0].anchors[1])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[1])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('verified')
          done()
        })
    })

    it('should return successful result with mixed (cal ok, btc bad) btc proof (json)', done => {
      let btcProof = JSON.parse(fs.readFileSync('./tests/sample-data/btc-proof.chp.json'))
      btcProof.branches[0].branches[0].ops[0].l = 'bad0cff025777bec277cd3a0599eaf5efbeb1ea7adf5ec5a39126a77fa57f837'
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [btcProof] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(2)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[0])
          expect(res.body[0].anchors[1]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[1]).length).to.equal(3)
          expect(res.body[0].anchors[1])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('btc_anchor_branch')
          expect(res.body[0].anchors[1])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('btc')
          expect(res.body[0].anchors[1])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[1])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('mixed')
          done()
        })
    })

    it('should return successful result with invalid cal proof (b64)', done => {
      let calProof = JSON.parse(fs.readFileSync('./tests/sample-data/cal-proof.chp.json'))
      calProof.hash = 'badf27222fe366d0b8988b7312c6ba60ee422418d92b62cdcb71fe2991ee7391'
      let calProofB64 = cpb.objectToBase64Sync(calProof)
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [calProofB64] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(1)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[0])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('invalid')
          done()
        })
    })

    it('should return successful result with invalid btc proof (b64)', done => {
      let btcProof = JSON.parse(fs.readFileSync('./tests/sample-data/btc-proof.chp.json'))
      btcProof.hash = 'badf27222fe366d0b8988b7312c6ba60ee422418d92b62cdcb71fe2991ee7391'
      let btcProofB64 = cpb.objectToBase64Sync(btcProof)
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [btcProofB64] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(2)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[0])
          expect(res.body[0].anchors[1]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[1]).length).to.equal(3)
          expect(res.body[0].anchors[1])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('btc_anchor_branch')
          expect(res.body[0].anchors[1])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('btc')
          expect(res.body[0].anchors[1])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[1])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('invalid')
          done()
        })
    })

    it('should return successful result with valid cal proof (b64)', done => {
      let calProof = JSON.parse(fs.readFileSync('./tests/sample-data/cal-proof.chp.json'))
      let calProofB64 = cpb.objectToBase64Sync(calProof)
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [calProofB64] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(calProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(1)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[0])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('verified')
          done()
        })
    })

    it('should return successful result with valid btc proof (b64)', done => {
      let btcProof = JSON.parse(fs.readFileSync('./tests/sample-data/btc-proof.chp.json'))
      let btcProofB64 = cpb.objectToBase64Sync(btcProof)
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [btcProofB64] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(2)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[0])
          expect(res.body[0].anchors[1]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[1]).length).to.equal(3)
          expect(res.body[0].anchors[1])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('btc_anchor_branch')
          expect(res.body[0].anchors[1])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('btc')
          expect(res.body[0].anchors[1])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[1])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('verified')
          done()
        })
    })

    it('should return successful result with mixed (cal ok, btc bad) btc proof (b64)', done => {
      let btcProof = JSON.parse(fs.readFileSync('./tests/sample-data/btc-proof.chp.json'))
      btcProof.branches[0].branches[0].ops[0].l = 'bad0cff025777bec277cd3a0599eaf5efbeb1ea7adf5ec5a39126a77fa57f837'
      let btcProofB64 = cpb.objectToBase64Sync(btcProof)
      request(insecureServer)
        .post('/verify')
        .set('Content-type', 'application/json')
        .send({ proofs: [btcProofB64] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.be.a('array')
            .and.to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_index')
            .and.to.be.a('number')
            .and.to.equal(0)
          expect(res.body[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_node)
          expect(res.body[0])
            .to.have.property('hash_submitted_node_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_node_at)
          expect(res.body[0])
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_id_core)
          expect(res.body[0])
            .to.have.property('hash_submitted_core_at')
            .and.to.be.a('string')
            .and.to.equal(btcProof.hash_submitted_core_at)
          expect(res.body[0])
            .to.have.property('anchors')
            .and.to.be.a('array')
          expect(res.body[0].anchors).to.have.length(2)
          expect(res.body[0].anchors[0]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[0]).length).to.equal(3)
          expect(res.body[0].anchors[0])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('cal_anchor_branch')
          expect(res.body[0].anchors[0])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors[0])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(true)
          expect(res.body[0].anchors[0])
          expect(res.body[0].anchors[1]).to.be.a('object')
          expect(Object.keys(res.body[0].anchors[1]).length).to.equal(3)
          expect(res.body[0].anchors[1])
            .to.have.property('branch')
            .and.to.be.a('string')
            .and.to.equal('btc_anchor_branch')
          expect(res.body[0].anchors[1])
            .to.have.property('type')
            .and.to.be.a('string')
            .and.to.equal('btc')
          expect(res.body[0].anchors[1])
            .to.have.property('valid')
            .and.to.be.a('boolean')
            .and.to.equal(false)
          expect(res.body[0].anchors[1])
          expect(res.body[0])
            .to.have.property('status')
            .and.to.be.a('string')
            .and.to.equal('mixed')
          done()
        })
    })
  })
})
