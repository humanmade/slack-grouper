'use strict'

// Include the serverless-slack bot framework
const slack = require('serverless-slack')

// The function that AWS Lambda will call
exports.handler = slack.handler.bind(slack)

slack.on('/group-create', (msg, bot) => {

  let handle   = msg.text.match(/@([A-Za-z0-9_-]+)/)
  let name     = msg.text.match(/\s([^#@][^#@]+)/)

  if ( ! handle ) {
    return bot.replyPrivate({
      text: '🤦‍♀️ You need to provide at minimum the group handle eg. `/group-create @group`'
    });
  }

  return bot.send('usergroups.create', {
      name: name ? name[1].trim() : handle[1].trim(),
      handle: handle[1].trim(),
      channels: msg.channel_id
    })
    .then(data => bot.reply({
      text: `😎 *@${data.usergroup.handle}* is good to go. Type \`/group-subscribe @${data.usergroup.handle}\` to join`
    }) )
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})

slack.on('/group-subscribe', (msg, bot) => {

  let usergroup = msg.text.match(/subteam\^([A-Za-z0-9_-]+)/)

  if ( ! usergroup ) {
    return bot.replyPrivate({
      text: '🤦‍♀️ You need to provide at minimum the group handle eg. `/group-subscribe @group`'
    })
  }

  return bot.send('usergroups.users.list', {
      usergroup: usergroup[1]
    })
    .then(data => bot.send('usergroups.users.update', {
      usergroup: usergroup[1],
      users: data.users.reduce((users, user) => `${users},${user}`, msg.user_id)
    }))
    .then(() => bot.replyPrivate({
      text: `One of us, one of us, one of us 🙌🤘🎉`
    }) )
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})

slack.on('/group-unsubscribe', (msg, bot) => {

  let usergroup = msg.text.match(/subteam\^([A-Za-z0-9_-]+)/)

  if ( ! usergroup ) {
    return bot.replyPrivate({
      text: '🤦‍♀️ You need to provide at minimum the group handle eg. `/group-unsubscribe @group`'
    })
  }

  return bot.send('usergroups.users.list', {
      usergroup: usergroup[1],
      include_disabled: false
    })
    .then(data => {
      let users = data.users.filter(user => user !== msg.user_id).join(',')
      if ( ! users ) {
        return bot.replyPrivate({
          text: `When you're the only user in the group, you cannot leave. It's kind of like a curse that you can totally pass on 👻`
        })
      }
      return bot.send('usergroups.users.update', {
        usergroup: usergroup[1],
        users: users
      })
    } )
    .then(() => bot.replyPrivate({
      text: `Well that's just fine then 😒`
    }) )
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})

slack.on('/group-list', (msg, bot) => {
  return bot.send('usergroups.list', {
      include_count: true
    })
    .then(data => bot.replyPrivate({
      attachments: [
        {
          title: 'Available user groups',
          color: '#c93c3c',
          mrkdwn_in: ['fields'],
          fields: data.usergroups.map(group => ({
            title: `${group.name}`,
            value: `@${group.handle}: ${group.user_count} users`,
            short: true
          }))
        }
      ]
    }) )
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})
