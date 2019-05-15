require('dotenv').config()
const inquirer = require('inquirer')
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN, { log: console.log })
const ldap = require('../lib/ldap')

async function chooseCourse () {
  let course

  while (!course) {
    const { courseId } = await inquirer.prompt({
      name: 'courseId',
      type: 'input',
      message: 'Write the canvas course ID (you can prefix "sis_course_id:" to use the SIS ID)',
      default: 'sis_course_id:LT1016VT191'
    })

    try {
      course = (await canvas.get(`courses/${courseId}`)).body

      const { ok } = await inquirer.prompt({
        name: 'ok',
        type: 'confirm',
        message: `Chosen course is "${course.name}". Is correct?`
      })

      if (!ok) {
        course = null
      }
    } catch (e) {
      console.error('X')
    }
  }

  return course
}

async function chooseSection (course) {
  const sections = await canvas.list(`/courses/${course.id}/sections`).toArray()

  const { section } = await inquirer.prompt({
    name: 'section',
    type: 'rawlist',
    message: 'Choose a section',
    choices: sections.map(s => ({
      value: s,
      name: `${s.sis_section_id} - ${s.name}`,
      short: s.name
    }))
  })

  return section
}

async function start () {
  console.log('This app will set up the Ladok data to a course.')
  console.log()

  const course = await chooseCourse()
  const section = await chooseSection(course)

  const { kurstillfalleUID } = await inquirer.prompt({
    name: 'kurstillfalleUID',
    type: 'input',
    message: 'Write the Ladok Kurstillfälle for that section (and its course)',
    default: section.integration_id || ''
  })

  await canvas.requestUrl(`/courses/sis_course_id:${courseId}`, 'PUT', {
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
  for await (const assignment of canvas.list(`/courses/sis_course_id:${courseId}/assignments`)) {
    assignments.push(assignment)
  }

  const { assignment } = await inquirer.prompt({
    name: 'assignment',
    type: 'rawlist',
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

  await canvas.requestUrl(`/courses/sis_course_id:${courseId}/assignments/${assignment.id}`, 'PUT', {
    assignment: {
      integration_id: modulUID
    }
  })

  console.log('Ladok user UID > students custom_data')

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

        await setUserLadokId(kthId, ladokId)
        console.log(`- Done for ${kthId}`)
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

/**
 * Update canvas integration_id of a user specified by kthid.
 *
 * Get login(s) with sis_user_id matching kthId and set integration_id of them to ladokId.
 * There will normally be exactly one matching login, but canvas handles it as an array.
 */
async function setUserLadokId(kthId, ladokId) {
  var done = 0;
  const logins = await canvas.requestUrl(`/users/sis_user_id:${kthId}/logins`, 'GET');
  for (const login of logins.body) {
    if (login.sis_user_id === kthId) {
      await canvas.requestUrl(`/accounts/${login.account_id}/logins/${login.id}`, 'PUT', {
        'login': {
          'integration_id': ladokId
        },
      })
      done += 1
    } else {
      console.log(`${login.sis_user_id} != ${kthId}`)
    }
  }
  console.log(`==> Updated ${done} login(s) for ${kthId}`)
}

start()
// ... or test: setUserLadokId('u1famwov', '000-00000-00-0000000-00-00000')
