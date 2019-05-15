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
    type: 'list',
    message: 'Choose a section',
    choices: sections
      .map(s => ({
        value: s,
        name: `${s.sis_section_id} - ${s.name}`,
        short: s.name
      }))
      .concat(new inquirer.Separator())
  })

  return section
}

async function chooseAssignment (course) {
  const assignments = await canvas.list(`/courses/${course.id}/assignments`).toArray()

  const { assignment } = await inquirer.prompt({
    name: 'assignment',
    type: 'list',
    message: 'Choose an assignment',
    choices: assignments
      .map(a => ({
        value: a,
        name: a.name,
        short: a.id
      }))
      .concat(new inquirer.Separator())
  })

  return assignment
}

async function setupCourse (course) {
  const { newId } = await inquirer.prompt({
    name: 'newId',
    type: 'input',
    message: 'Write the Ladok Kurstillfälle UID for this course',
    default: course.integration_id
  })

  if (newId !== course.integration_id) {
    course = (await canvas.requestUrl(`/courses/${course.id}`, 'PUT', {
      course: {
        integration_id: newId
      }
    })).body
  }

  return course
}

async function setupSection (course, section) {
  const { newId } = await inquirer.prompt({
    name: 'newId',
    type: 'input',
    message: 'Write the Ladok Kurstillfälle UID for this section',
    default: section.integration_id || course.integration_id
  })

  if (newId !== section.integration_id) {
    section = (await canvas.requestUrl(`/sections/${section.id}`, 'PUT', {
      course_section: {
        integration_id: newId
      }
    })).body
  }

  return section
}

async function setupAssignment (assignment) {
  const { newId } = await inquirer.prompt({
    name: 'newId',
    type: 'input',
    message: 'Write the Ladok Modul UID or Moment UID for that assignment',
    default: assignment.integration_id
  })

  if (newId !== assignment.integration_id) {
    assignment = (await canvas.requestUrl(`/courses/${course.id}/assignments/${assignment.id}`, 'PUT', {
      assignment: {
        integration_id: modulUID
      }
    })).body
  }

  return assignment
}


/**
 * Update canvas integration_id of a user specified by kthid.
 *
 * Get login(s) with sis_user_id matching kthId and set integration_id of them to ladokId.
 * There will normally be exactly one matching login, but canvas handles it as an array.
 */
async function setupUser (kthId, ladokId) {
  let done = 0;
  for await (const login of canvas.list(`/users/sis_user_id:${kthId}/logins`)) {
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


async function start () {
  console.log('This app will set up the Ladok data to a course.')
  console.log()

  let course = await chooseCourse()
  let section = await chooseSection(course)

  course = await setupCourse(course)
  section = await setupSection(course, section)

  let assignment = await chooseAssignment(course)
  assignment = await setupAssignment(assignment)

  const { setupUsers } = await inquirer.prompt({
    name: 'setupUsers',
    type: 'confirm',
    message: 'Do you want to set the Ladok ID to all the users in the section?'
  })

  if (!setupUsers) {
    return
  }

  try {
    await ldap.connect()

    for await (const enrollment of canvas.list(`sections/${section.id}/enrollments`)) {
      const kthId = enrollment.user.sis_user_id

      if (kthId) {
        const [user] = await ldap.search(`(ugKthId=${kthId})`, ['ugLadok3StudentUid'])
        const ladokId = user.ugLadok3StudentUid

        await setupUser(kthId, ladokId)
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

start()
// ... or test: setUserLadokId('u1famwov', '000-00000-00-0000000-00-00000')
