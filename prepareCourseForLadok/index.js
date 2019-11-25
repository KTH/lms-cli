require('dotenv').config()
const inquirer = require('inquirer')
const canvas = require('@kth/canvas-api')(process.env.CANVAS_API_URL, process.env.CANVAS_API_TOKEN)
const got = require('got')

async function createButton (course) {
  const { createButton } = await inquirer.prompt({
    type: 'confirm',
    name: 'createButton',
    message: 'Do you want to create a link in the menu?'
  })
  if (!createButton) {
    return
  }
  const buttonName = 'KTH - Export to Ladok (BETA)'

  let buttonUrl
  if (process.env.CANVAS_API_URL === 'https://kth.instructure.com/api/v1') {
    buttonUrl = 'https://api.kth.se/api/lms-export-to-ladok/export'
  } else if (process.env.CANVAS_API_URL === 'https://kth.test.instructure.com/api/v1') {
    buttonUrl = 'https://api-r.referens.sys.kth.se/api/lms-export-to-ladok/export'
  }

  const body = {
    name: buttonName,
    consumer_key: 'not_used',
    shared_secret: 'not_used',
    url: buttonUrl,
    privacy_level: 'public',
    course_navigation: {
      visibility: 'admins',
      windowTarget: '_self',
      text: buttonName,
      default: false,
      enabled: true
    },
    editor_button: {
      enabled: false
    }
  }
  const newButton = await canvas.requestUrl(`/courses/${course.id}/external_tools`, 'POST', body)
  console.log(`New button created with ID: ${newButton.body.id}`)
}

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
        login: {
          integration_id: ladokId
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
  console.log(`This app will set up the Ladok data to a course in ${process.env.CANVAS_API_URL}.`)
  console.log()

  const course = await chooseCourse()
  await createButton(course)
  const assignments = await canvas.list(`/courses/${course.id}/assignments`).toArray()

  const [, courseCode, term, year] = course.sis_course_id.match(/(.*)(VT|HT)(\d{2})\d/)

  const { body: courseDetails } = await got(`https://api.kth.se/api/kopps/v2/course/${courseCode}/detailedinformation`, { json: true })
  const termUtils = {
    VT: 1,
    HT: 2,
    1: 'VT',
    2: 'HT'
  }

  const gradingSchemas = {
    AF: 562,
    PF: 609
  }

  const termNumber = `20${year}${termUtils[term]}`
  const examinationSets = Object.values(courseDetails.examinationSets)
    .sort((a, b) => parseInt(a.startingTerm.term, 10) - parseInt(b.startingTerm.term, 10))
    .filter(e => parseInt(e.startingTerm.term, 10) <= termNumber)

  const examinationRounds = examinationSets[examinationSets.length - 1].examinationRounds
  console.log('examinationRounds in Ladok: ', examinationRounds)
  for (const examinationRound of examinationRounds) {
    const assignmentSisID = `${course.sis_course_id}_${examinationRound.examCode}`
    const assignment = assignments.find(a => a.integration_data.sis_assignment_id === assignmentSisID)

    const modulId = examinationRound.ladokUID

    const body = {
      assignment: {
        name: `LADOK - ${examinationRound.examCode} (${examinationRound.title})`,
        description: `Denna uppgift motsvarar Ladokmodul <strong>"${examinationRound.title}" (${examinationRound.examCode})</strong>.<br>Betygsunderlag i denna uppgift skickas till Ladok.`,
        muted: true,
        submission_types: ['none'],
        grading_type: 'letter_grade',
        points_possible: 10,
        grading_standard_id: gradingSchemas[examinationRound.gradeScaleCode],
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

  if (setupUsers) {
    const ldap = require('../lib/ldap')
    try {
      await ldap.connect()
      const section = await chooseSection(course)
      for await (const enrollment of canvas.list(`sections/${section.id}/enrollments`, { type: 'StudentEnrollment' })) {
        const kthId = enrollment.user.sis_user_id

        if (kthId) {
          const [user] = await ldap.search(`(ugKthId=${kthId})`, [])
          if (!user) {
            throw new Error(`No user found for ${kthId}`)
          }

          const ladokId = user.ugLadok3StudentUid
          if (ladokId) {
            await setupUser(kthId, ladokId)
          } else {
            console.error('No ladok id found for the user ', user)
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
}

start().catch(e => console.error(e))
// ... or test: setUserLadokId('u1famwov', '000-00000-00-0000000-00-00000')
