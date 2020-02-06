require('dotenv').config()
require('colors')
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
let totalUsersChecked = 0
let disabledUsers = 0
async function doIt(){
    const ldap = require('../lib/ldap')
      await ldap.connect()
      for await (const user of canvas.list(`/accounts/1/users` )) {
         const kthId = user.sis_user_id
       // const kthId = 'u1cssscc' 
        if (kthId) {

        totalUsersChecked ++
          const [ldapUser] = await ldap.search(`(ugKthId=${kthId})`, [])
          if(!ldapUser || ldapUser.ugDisabled === 'true'){
            disabledUsers ++ 

            // list enrollments
            const {body:enrollments}= await canvas.get(`/users/sis_user_id:${kthId}/enrollments`)
            if(enrollments.length){
              console.log('User has enrollments'.redBG) 
            }
            console.log(`enrollments for user ${kthId}:`, enrollments)
          }
          console.log(`${Math.round(disabledUsers/totalUsersChecked*100000)/1000}% of ${totalUsersChecked} users are disabled (${disabledUsers})`.green)
        }
      }
    try {
      await ldap.disconnect()
    } catch (e) {
      console.log('Error:', e)
    }
  }

doIt()
