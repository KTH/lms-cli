require('dotenv').config()
const inquirer = require('inquirer')
const rp = require('request-promise')
const chalk = require('chalk')

async function getBuilds (app) {
  const auth = `Basic ${Buffer.from(process.env.BUILD_USERNAME + ':' + process.env.BUILD_TOKEN).toString('base64')}`

  const { builds } = await rp({
    url: `https://build.sys.kth.se/job/${app}/api/json?tree=builds[number,url]`,
    method: 'GET',
    json: true,
    headers: {
      'Authorization': auth
    }
  })

  const buildsStatus = await Promise.all(builds.map(({ url }) => rp({
    url: `${url}/api/json?`,
    method: 'GET',
    json: true,
    headers: {
      'Authorization': auth
    }
  })))

  return buildsStatus
    .map(({ id, result, actions }) => ({
      id,
      result,
      actions: actions
        .filter(a => a._class && a._class.includes('git'))
        .map(a => a.lastBuiltRevision || (a.build && a.build.revision))
        .filter(a => a)
    }))
    .map(({ id, result, actions }) => ({
      id,
      result,
      commit: actions[0].SHA1,
      branch: actions[0].branch[0].name
    }))
}

async function getVersion(url) {
  try {
    const html = await rp({
      method: 'GET',
      followRedirect: false,
      url
    })

    const line = html
      .split('\n')
      .filter(line => line.indexOf('version.dockerVersion:') !== -1)[0]

    return line.split(':')[1]
  } catch (e) {
    return undefined
  }
}

async function start () {
  const { project } = await inquirer.prompt({
    name: 'project',
    message: 'Which project do you want to look at?',
    type: 'list',
    choices: [
      'lms-sync-users',
      'lms-sync-courses',
      'lms-export-results',
      'lms-web'
    ]
  })

  const urls = {
    'lms-export-results': [
      'lms-export-results',
      'https://api.kth.se/api/lms-export-results/_about',
      'https://api-r.referens.sys.kth.se/api/lms-export-results/_about'
    ],
    'lms-sync-users': [
      'lms-sync-users',
      'https://api.kth.se/api/lms-sync-users/_about',
      'https://api-r.referens.sys.kth.se/api/lms-sync-users/_about'
    ],
    'lms-sync-courses': [
      'lms-sync-courses',
      'https://api.kth.se/api/lms-sync-courses/_about',
      'https://api-r.referens.sys.kth.se/api/lms-sync-courses/_about'
    ],
    'lms-web': [
      'lms-web',
      'https://app.kth.se/app/lms-web/_about',
      'https://app-r.referens.sys.kth.se/app/lms-web/_about'
    ]
  }

  const [jobName, activeUrl, stageUrl] = urls[project]

  const builds = await getBuilds(jobName)
  const active = (await getVersion(activeUrl)) || '0.0.1000_x'
  const stage = (await getVersion(stageUrl)) || '0.0.1000_x'
  const minRelevant = Math.min(
    active.split('.')[2].split('_')[0],
    stage.split('.')[2].split('_')[0]
  )

  const info = builds.filter(b => b.id >= minRelevant - 3).map(b => {
    const short = b.commit.slice(0, 7)


    return {
      id: b.id,
      result: b.result,
      commit: short,
      branch: b.branch,
      active: active.indexOf(b.id + '_' + short) !== -1,
      stage: stage.indexOf(b.id + '_' + short) !== -1
    }
  })

  function format (result, message) {
    switch (result) {
      case 'SUCCESS': return chalk.green(message)
      case 'FAILURE': return chalk.red(message)
      case 'ABORTED': return chalk.gray(message)
      default: return message + `(${result})`
    }
  }

  console.log(info.map(i => [
    format(i.result, `#${i.id}`) + ' ' + i.commit,
    ' - ',
    i.active ? chalk.bgMagenta('DEPLOYED IN ACTIVE') : '',
    i.stage ? chalk.bgCyan('DEPLOYED IN STAGE') : '',
    '   ',
    i.branch
  ].join('')).join('\n'))
}

start()
