require('dotenv').config()
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
const ldap = require('../lib/ldap')

async function start () {
  console.log('Set LadokID (obtained from UG) to all users in a canvas course round (section)')
  console.log()

  const sectionId = 'LT1016VT191'

  await ldap.connect()

  for await (const enrollment of canvas.list(`sections/sis_section_id:${sectionId}/enrollments`)) {
    const kthId = enrollment.user.sis_user_id

    if (kthId) {
      const a = await ldap.search(`(ugKthId=${kthId})`)
      console.log(kthId, a[0].ugLadok3StudentUid)
    }

  }

  await ldap.disconnect()
}

start()
