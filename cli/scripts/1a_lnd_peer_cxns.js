const path = require('path')
const lightning = require('lnrpc-node-client')
const { isEmpty } = require('lodash')
const { pipeP } = require('ramda')
const homedir = require('os').homedir()
const { buildRequestOptions, coreRequestAsync } = require('../../lib/cores')

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/tls.cert')
)

async function getCoreStatus(coreIP) {
  try {
    let getStatusOptions = buildRequestOptions(null, 'GET', '/status')
    let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)

    return {
      host: coreIP,
      pubkey: coreResponse.pubkey
    }
  } catch (_) {
    return undefined
  }
}

const connectPeer = opts => {
  if (isEmpty(opts)) Promise.reject(false)

  return new Promise((resolve, reject) => {
    lightning.lightning().connectPeer(opts, (err, res) => {
      if (err) reject(false)
      else resolve(res)
    })
  })
}

module.exports = coreIPs => {
  return Promise.all(
    coreIPs.map(currVal =>
      pipeP(
        getCoreStatus,
        connectPeer
      )(currVal)
    )
  ).catch(() => {})
}
