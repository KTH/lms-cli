require('dotenv').config()
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
const ldap = require('../lib/ldap')

async function start () {
  try {
    console.log('Set LadokID (obtained from UG) to all users in a canvas course round (section)')
    console.log()

    const sectionId = 'LT1016VT191'

    await ldap.connect()

    for await (const enrollment of canvas.list(`sections/sis_section_id:${sectionId}/enrollments`)) {
      const kthId = enrollment.user.sis_user_id

      if (kthId) {
        const [user] = await ldap.search(`(ugKthId=${kthId})`, ['ugLadok3StudentUid'])
        const ladokId = user.ugLadok3StudentUid

        await canvas.requestUrl(`/users/sis_user_id:${kthId}/custom_data/ladok_uid`, 'PUT', {
          ns: 'se.kth',
          data: ladokId
        })
      }
    }

  } catch (e) {
    console.log("Error:", e)
  }
  try {
    await ldap.disconnect()
  } catch (e) {
    console.log("Error:", e)
  }
}

start()
