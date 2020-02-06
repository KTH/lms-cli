require('dotenv').config()
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
let totalUsersChecked = 0
let disabledUsers = 0
async function doIt(){
    const ldap = require('../lib/ldap')
    try {
      await ldap.connect()
      for await (const user of canvas.list(`/accounts/1/users` )) {
        const kthId = user.sis_user_id

        if (kthId) {

        totalUsersChecked ++
          const [ldapUser] = await ldap.search(`(ugKthId=${kthId})`, [])
          if (!ldapUser) {
            throw new Error(`No user found for ${kthId}`)
          }
          // TODO: check disabled in UG
          if(true){
           disabledUsers ++ 

          }
          // console.log(ldapUser)

          console.log(`${Math.round(disabledUsers/totalUsersChecked*100000)/1000}% of ${totalUsersChecked} users are disabled (${disabledUsers})`)
        }
      }
    } catch (e) {
      console.log('Error:', e)
    }
    try {
      await ldap.disconnect()
    } catch (e) {
      console.log('Error:', e)
    }
  }

doIt()
