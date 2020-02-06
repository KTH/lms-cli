require('dotenv').config()
require('colors')

const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)

let totalUsersChecked = 0
let disabledUsers = 0
let usersWithEnrollments = 0
let nonRappStudentEnrollments = 0
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
              usersWithEnrollments++
              console.log('User has enrollments'.redBG) 
            }

            if(enrollments.find(it => it.sis_course_id && !it.sis_course_id.startsWith('RAPP_') && it.role === 'StudentEnrollment')){
             nonRappStudentEnrollments++ 
            }

            console.log(`enrollments for user ${kthId}:`, enrollments)
          }
          console.log(`${Math.round(disabledUsers/totalUsersChecked*100000)/1000}% ${disabledUsers} of ${totalUsersChecked} users are disabled where ${usersWithEnrollments} has some enrollments, and ${nonRappStudentEnrollments} are enrolled in a non Rapp course round`.green)
        //   console.log(ldapUser)
        //   process.exit()
        }
      }
    try {
      await ldap.disconnect()
    } catch (e) {
      console.log('Error:', e)
    }
  }

doIt()
