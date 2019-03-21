require('dotenv').config()

const fs = require('fs')
const Canvas = require('kth-canvas-api')
const canvas = new Canvas(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)

async function start () {
  const fileName = '/tmp/results2.csv'
  fs.writeFileSync(fileName, [
    'user_id',
    'role',
    'section_id',
    'status'
  ].join(',') + '\n')

  const originSection = 'app.katalog3.V.section1'
  const destinationSection = 'app.katalog3.T.section1'

  const originEnrollments = await canvas.get(`/sections/sis_section_id:${originSection}/enrollments?per_page=100`)
  const destinationEnrollments = await canvas.get(`/sections/sis_section_id:${destinationSection}/enrollments?per_page=100`)

  for (let oe of originEnrollments) {
    const de = destinationEnrollments.find(e2 => e2.sis_user_id === oe.sis_user_id)

    fs.appendFileSync(fileName, [
      oe.sis_user_id,
      'student',
      originSection,
      'deleted'
    ].join(',') + '\n', 'utf8')

    if (!de) {
      fs.appendFileSync(fileName, [
        oe.sis_user_id,
        'student',
        destinationSection,
        'active'
      ].join(',') + '\n', 'utf8')
    }
  }
}

start()
