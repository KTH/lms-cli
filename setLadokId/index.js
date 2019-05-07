require('dotenv').config()
const inquirer = require('inquirer')
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN, { log: console.log })
const ldap = require('../lib/ldap')

async function start () {
  console.log('Set Ladok UIDs to all Canvas objects')
  console.log()

  console.log('Ladok kurstilfälle UID > Section')
  const sectionId = 'LT1016VT191'
  const section = (await canvas.get(`courses/sis_course_id:${sectionId}/sections/sis_section_id:${sectionId}`)).body

  console.log('- Section and Course in Canvas is', section.name)

  const { kurstillfalleUID } = await inquirer.prompt({
    name: 'kurstillfalleUID',
    type: 'input',
    message: 'Write the Ladok Kurstillfälle for that section (and its course)',
    default: section.integration_id || ''
  })

  await canvas.requestUrl(`/courses/sis_course_id:${sectionId}`, 'PUT', {
    course: {
      integration_id: kurstillfalleUID
    }
  })

  await canvas.requestUrl(`/sections/sis_section_id:${sectionId}`, 'PUT', {
    course_section: {
      integration_id: kurstillfalleUID
    }
  })

  console.log('Ladok moment UID > Assignment')

  const assignments = []
  for await (const assignment of canvas.list(`/courses/sis_course_id:${sectionId}/assignments`)) {
    assignments.push(assignment)
  }

  const { assignment } = await inquirer.prompt({
    name: 'assignment',
    type: 'list',
    message: 'Choose an assignment',
    choices: assignments.map(a => ({
      value: a,
      name: a.name,
      short: a.id
    }))
  })

  const { modulUID } = await inquirer.prompt({
    name: 'modulUID',
    type: 'input',
    message: 'Write the Ladok Modul UID or Moment UID for that assignment',
    default: assignment.integration_id
  })

  await canvas.requestUrl(`/courses/sis_course_id:${sectionId}/assignments/${assignment.id}`, 'PUT', {
    assignment: {
      integration_id: modulUID
    }
  })

  console.log('Ladok user UID > students custom_data')

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

      console.log(`- Done for ${kthId}`)
    }
  }

  await ldap.disconnect()
}

start()
