require('dotenv').config()
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN, {log: console.log})

async function start () {
  console.log('Set LadokID (obtained from UG) to all users in a canvas course round (section)')
  console.log()

  const sectionId = 'LT1016VT191'

  for await (const enrollment of canvas.list(`sections/sis_section_id:${sectionId}/enrollments`)) {
    console.log(enrollment.user.sis_user_id)
  }
}

start()
