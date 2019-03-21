const ldap = require('ldapjs')
const client = ldap.createClient({
  url: process.env.LDAP_URL
})

function connect () {
  return new Promise((resolve, reject) => {
    client.bind(process.env.LDAP_USERNAME, process.env.LDAP_PASSWORD, (err) => {
      if (err) {
        return reject(err)
      }

      resolve()
    })
  })
}

function search (filter) {
  return new Promise((resolve, reject) => {
    const options = {
      filter,
      scope: 'sub',
      paged: true,
      sizeLimit: 1000,
      attributes: []
    }

    const result = []

    client.search(process.env.LDAP_BASE, options, (err, response) => {
      if (err) {
        reject(err)
      } else {
        response.on('searchEntry', entry => {
          result.push(entry.object)
        })

        response.on('error', (err) => {
          reject(err)
        })

        response.on('end', () => {
          resolve(result)
        })
      }
    })
  })
}

function disconnect () {
  return new Promise((resolve, reject) => {
    client.unbind(err => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}



module.exports = {
  connect,
  search,
  disconnect
}
