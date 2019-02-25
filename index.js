async function start () {
  console.log(
    [
      'Running "deadLetters/index.js.',
      'Psst. As a shortcut, the next time you can run `node deadLetters`'
    ].join('\n')
  )

  require('./deadLetters')
}

start()
