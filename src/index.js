'use strict'

// Include the serverless-slack bot framework
const slack = require('serverless-slack')

// The function that AWS Lambda will call
exports.handler = slack.handler.bind(slack)

// create a group
slack.on('/group-create', (msg, bot) => {

  let handle   = msg.text.match(/@([A-Z0-9_-]+)/i)
  let name     = msg.text.match(/\s([^#@][^#@]+)/)

  if ( ! handle ) {
    return bot.replyPrivate({
      text: '🤦‍ You need to provide at minimum the group handle eg. `/group-create @group`'
    });
  }

  return bot.send('usergroups.create', {
      name: name ? name[1].trim() : handle[1].trim(),
      handle: handle[1].trim(),
      channels: msg.channel_id
    })
    .then(data => slack.callback({
      response_type: 'in_channel',
      text: `😎 *@${data.usergroup.handle}* is good to go. Type \`/group-subscribe @${data.usergroup.handle}\` to join`
    }) )
    .catch(err => {
      if ( err.error && err.error.includes('already_exists') ) {
        return bot.replyPrivate({
          text: `That group already exists! Join it using \`/group-subscribe @${handle[1]}\``
        })
      }
      return err.error ? bot.replyPrivate({
        text: `Uh oh - something went wrong: ${err.error}`
      }) : null
    })
})

// invite people to a group
slack.on('/group-invite', (msg, bot) => {

  let usergroup = msg.text.match(/subteam\^([A-Z0-9_-]+)(?:\|(@[A-Z0-9\._-]+))?/i)

  if ( ! usergroup ) {
    return bot.replyPrivate({
      text: '🤦‍ You need to provide the group handle and usernames eg. `/group-invite @group @vic @bob`'
    })
  }

  let users = msg.text.match(/<@(U[A-Z0-9_-]+)(?:\|([A-Z0-9_-]+))?>/gi)

  if ( ! users ) {
    return bot.replyPrivate({
      text: '🤦‍ You need to provide some usernames to invite to the group eg. `/group-invite @group @vic @bob`'
    })
  }

  bot.replyPrivate({
    text: `Ok, sending the invites out. Now we play the waiting game... ⏰`
  })

  return users.forEach(user => {
    let user_name = user.match(/\|([A-Z0-9\._-]+)>/i)[1]

    bot.say({
      channel: `@${user_name}`,
      text: `Hey, <@${msg.user_id}> has invited you to join <!subteam^${usergroup[1]}> 👯`,
      attachments: [
        {
          attachment_type: 'default',
          callback_id: 'grouper_invite',
          fallback: `Group invite opt-in not supported - use "/group-subscribe ${usergroup[2]}" to join`,
          actions: [
            {
              name: `${msg.user_id}|${msg.user_name}`,
              text: `👍 Sign me up`,
              type: 'button',
              value: `${usergroup[1]}|true`,
              style: 'primary'
            },
            {
              name: `${msg.user_id}|${msg.user_name}`,
              text: `👎 I’m good thanks`,
              type: 'button',
              value: `${usergroup[1]}|false`
            }
          ]
        }
      ]
    })
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
  })
})

// im response actions
slack.on('grouper_invite', (msg, bot) => {

  let [user_id, user_name] = msg.actions[0].name.split('|')
  let [usergroup, yes]     = msg.actions[0].value.split('|')

  // was a nope
  if ( ! JSON.parse(yes) ) {
    // notify inviter
    bot.say({
      channel: `@${user_name}`,
      text: `Sad times, <@${msg.user.id}> declined your invitation to join <!subteam^${usergroup}> 😳`
    })

    // acknowledge action
    return bot.reply({
        text: `Invitation from <@${user_id}> to join <!subteam^${usergroup}> has been noped 🙅`
      })
      .catch(err => err.error ? bot.replyPrivate({
        text: `Uh oh - something went wrong: ${err.error}`
      }) : null )
  }

  // notify inviter
  bot.say({
    channel: `@${user_name}`,
    text: `Whoop, <@${msg.user.id}> accepted your invitation to join <!subteam^${usergroup}>! ☺️`
  })

  // subscribe user & acknowledge
  return bot.send('usergroups.users.list', {
      usergroup
    })
    .then(data => bot.send('usergroups.users.update', {
      usergroup,
      users: data.users.reduce((users, user) => `${users},${user}`, msg.user.id)
    }))
    .then(() => bot.reply({
      text: `Ace, you're now a member of <!subteam^${usergroup}>! 🤗`
    }))
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})

// join a group
slack.on('/group-subscribe', (msg, bot) => {

  let usergroup = msg.text.match(/subteam\^([A-Z0-9_-]+)/i)

  if ( ! usergroup ) {
    return bot.replyPrivate({
      text: '🤦‍ You need to provide at minimum the group handle eg. `/group-subscribe @group`'
    })
  }

  return bot.send('usergroups.users.list', {
      usergroup: usergroup[1]
    })
    .then(data => bot.send('usergroups.users.update', {
      usergroup: usergroup[1],
      users: data.users.reduce((users, user) => `${users},${user}`, msg.user_id)
    }))
    .then(() => slack.callback({
      response_type: 'in_channel',
      text: `One of us! One of us! One of us! 🙌🤘🎉`
    }))
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null)
})

// leave a group
slack.on('/group-unsubscribe', (msg, bot) => {

  let usergroup = msg.text.match(/subteam\^([A-Z0-9_-]+)/i)

  if ( ! usergroup ) {
    return bot.replyPrivate({
      text: '🤦‍ You need to provide at minimum the group handle eg. `/group-unsubscribe @group`'
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
      text: `👋 Unsubscribed! We'll try not to take it personally`
    }) )
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})

// list all groups
// list users in a group
// list a users groups
slack.on('/group-list', (msg, bot) => {

  let search = msg.text.trim()

  return bot.send('usergroups.list', {
      include_count: true,
      include_users: true,
    })
    .then(data => {

      let usergroups = data.usergroups
      let usergroup  = search.match(/subteam\^([A-Z0-9_-]+)/i)
      let user       = search.match(/@(U[A-Z0-9_-]+)/i)
      let title      = `👥 Available user groups`
      let fields     = [ {
        title: `No results found`,
        value: `Try something less specific, it's a pretty dumb search`
      } ]

      if ( usergroup ) {
        // @ links for the users in the matched group
        return {
          attachments: [
            {
              title: `👥 Users in ${search}`,
              color: '#5abce0',
              mrkdwn_in: ['fields'],
              fields: usergroups
                .filter(group => group.id === usergroup[1])
                .reduce((cur, group) => group.users, [])
                .map(user => ({
                  value: `<@${user}>`,
                  short: true
                }))
            }
          ]
        }
      } else if ( user ) {
        // show groups for user
        title      = `👥 ${search}’s groups`
        usergroups = usergroups.filter(group => group.users.includes(user[1]))
      } else if ( search ) {
        // regular text search
        title      = `👥 User groups matching “${search}”`
        usergroups = usergroups.filter(group => ! search || group.name.includes(search) || group.handle.includes(search))
      }

      // Map fields if we have results
      if ( usergroups.length ) {
        fields = usergroups
          .map(group => ({
            title: `${group.name}`,
            value: `@${group.handle}: ${group.user_count} users`,
            short: true
          }))
      }

      return {
        attachments: [
          {
            title,
            color: '#5abce0',
            mrkdwn_in: ['fields'],
            fields
          }
        ]
      }
    } )
    .then(data => bot.replyPrivate(data))
    .catch(err => err.error ? bot.replyPrivate({
      text: `Uh oh - something went wrong: ${err.error}`
    }) : null )
})
