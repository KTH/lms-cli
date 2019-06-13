require('dotenv').config()
const inquirer = require('inquirer')
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN, { log: console.log })
const ldap = require('../lib/ldap')
const got = require('got')
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
      console.error(e)
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

async function setupAssignment (assignment, course) {
  const { newId } = await inquirer.prompt({
    name: 'newId',
    type: 'input',
    message: 'Write the Ladok Modul UID or Moment UID for that assignment',
    default: assignment.integration_id
  })

  if (newId !== assignment.integration_id) {
    assignment = (await canvas.requestUrl(`/courses/${course.id}/assignments/${assignment.id}`, 'PUT', {
      assignment: {
        integration_id: newId
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
  let done = 0
  for await (const login of canvas.list(`/users/sis_user_id:${kthId}/logins`)) {
    if (login.sis_user_id === kthId) {
      const body = {
        'login': {
          'integration_id': ladokId
        }
      }
      await canvas.requestUrl(`/accounts/${login.account_id}/logins/${login.id}`, 'PUT', body)
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

  const assignments = await canvas.list(`/courses/${course.id}/assignments`).toArray()

  const [, courseCode, term, year] = course.sis_course_id.match(/(\w{2}\d{4})(VT|HT)(\d{2})\d/)
  const { body: courseDetails } = await got(`https://api.kth.se/api/kopps/v2/course/${courseCode}/detailedinformation`, { json: true })
  const termUtils = {
    'VT': 1,
    'HT': 2,
    1: 'VT',
    2: 'HT'
  }

  const gradingSchemas = {
    'AF': 562,
    'PF': 609
  }

  const termNumber = `20${year}${termUtils[term]}`
  const examinationRounds = courseDetails.examinationSets[termNumber].examinationRounds
  for (let examinationRound of examinationRounds) {
    const assignmentSisID = `${course.sis_course_id}_${examinationRound.examCode}`
    const assignment = assignments.find(a => a.integration_data.sis_assignment_id === assignmentSisID)

    const { modulId } = await inquirer.prompt({
      name: 'modulId',
      type: 'input',
      message: `Enter the ladok id for the module '${examinationRound.title}'`,
      default: assignment.integration_id })

    const body = {
      'assignment': {
        'name': examinationRound.title,
        description: `Denna uppgift motsvarar Ladokmodul <strong>"${examinationRound.title}" (${examinationRound.examCode})</strong>.<br>Betygsunderlag i denna uppgift skickas till Ladok.`,
        'muted': true,
        'submission_types': ['none'],
        'grading_type': 'letter_grade',
        'grading_standard_id': gradingSchemas[examinationRound.gradeScaleCode],
        integration_id: modulId,
        integration_data: JSON.stringify({
          sis_assignment_id: assignmentSisID
        })
      }
    }

    if (!assignment) {
      await canvas.requestUrl(`courses/${course.id}/assignments/`, 'POST', body)
    } else if (modulId !== assignment.integration_id) {
      await canvas.requestUrl(`courses/${course.id}/assignments/${assignment.id}`, 'PUT', body)
    }
  }

  const { setupUsers } = await inquirer.prompt({
    name: 'setupUsers',
    type: 'confirm',
    message: 'Do you want to set the Ladok ID to all the users in the section?'
  })

  if (!setupUsers) {

  }

  try {
    await ldap.connect()

    for await (const enrollment of canvas.list(`sections/${section.id}/enrollments`, { type: 'StudentEnrollment' })) {
      const kthId = enrollment.user.sis_user_id

      if (kthId) {
        const [user] = await ldap.search(`(ugKthId=${kthId})`, ['ugLadok3StudentUid'])
        if (!user) {
          throw new Error(`No user found for ${kthId}`)
        }

        const ladokId = user.ugLadok3StudentUid
        if (ladokId) {
          await setupUser(kthId, ladokId)
        } else {
          console.error('No ladok id found for the user ', user)
          process.exit()
        }
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

start().catch(e => console.error(e))
// ... or test: setUserLadokId('u1famwov', '000-00000-00-0000000-00-00000')
