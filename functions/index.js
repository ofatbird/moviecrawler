const functions = require('firebase-functions')
const superagent = require('superagent')
const cheerio = require('cheerio')
const eventEmitter = require('events')
const path = require('path')

let __SORTED_ID__ = ''
const emitter = new eventEmitter()
const timeoutUri = {}
const mainUri = 'www.dytt8.net/'

const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase)
const refNode = admin.database().ref('/films')

require('superagent-charset')(superagent)

emitter.on('mainpage', (e) => {
  console.log('Main page timeout')
})
emitter.on('subpage', (e) => {
  console.log(`${e} timeout`)
})
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions

function frequency () {
  return Math.floor(Math.random() * (200 - 20) + 20)
}

function fetchData (uri, callback) {
  superagent.get(uri)
    .charset('gb2312')
    .timeout(20000)
    .end((err, res) => {
      if (err) {
        callback(err, null)
      } else {
        callback(err, cheerio.load(res.text))
      }
    })
}

function getUpdate (uri, exists) {
  if (exists) {
    __SORTED_ID__ = Object.keys(exists).sort((a, b) => {
      return a - b
		})
  }
  return new Promise((resolve, reject) => {
    fetchData(uri, (err, $) => {
      if (err) {
        reject(err)
        emitter.emit('mainpage', uri)
      } else {
        const data = []
        $('.co_content8').eq(0).find('tbody>tr').each((index, element) => {
          const link = $(element).find('td').eq(0).find('a').eq(1).attr('href')
					const id = path.basename(link).replace(/\.html$/, '')
          if (__SORTED_ID__.includes(id)) return
          data.push({
            id,
            uri: `http://${path.join(uri, link)}`
          })
        })
        resolve(data)
      }
    })
  })
}
function deleteId (id) {
  return refNode.child(id).set(null)
}

function updateData (data, index) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      fetchData(data.uri, (err, $) => {
        if (err) {
          resolve(err)
        } else {
          const name = $('font[color=#07519a]').eq(0).text()
          const coverUri = $('img[onclick]').eq(0).attr('src')
          let downloadlink = []
          $('a').each((index, ele) => {
            const href = $(ele).attr('href')
            if (href.indexOf('ftp') > -1) {
              downloadlink.push(href)
            }
          })
          if (name && coverUri && downloadlink.length) {
            const links = downloadlink.join('**')
            refNode.update({
              [data.id]: {
                name,
                links,
              coverUri}
            }).then(() => {
              if (__SORTED_ID__.length < 15) {
                resolve(`Nothing delete, insert${data.id}`)
              } else {
                deleteId(__SORTED_ID__.shift()).then(() => {
                  resolve(`Deleted, insert${data.id}`)
                })
							}
							__SORTED_ID__.push(data.id)
            }).catch(err => resolve(err))
          } else {
            resolve(`${data.id} not inserted`)
          }
        }
      })
    }, frequency() * index)
  })
}

// addTask(mainUri).then(data => console.log(Object(data))).catch(err => console.log(err))
function addUpdate (uri, retrieved) {
  return getUpdate(uri, retrieved).then(datas => Promise.all(datas.map(updateData)))
}
exports.movieHeaven = functions.https.onRequest((request, response) => {
  if (__SORTED_ID__.length) {
		console.log('start from Array')
    addUpdate(`http://${mainUri}`)
      .then(msg => {
        console.log('Done')
        response.send(`Success from Array\n${msg.join('\n')}`)
      })
      .catch(err => {
        console.log(err)
        response.send(err)
      })
  } else {
		console.log('start from DataBase')
		refNode.once('value')
    .then(snap => addUpdate(`http://${mainUri}`, snap.val()))
    .then(msg => {
      console.log('Done')
      response.send(`Success from Database\n${msg.join('\n')}`)
    })
    .catch(err => {
      console.log(err)
      response.send(err)
    })
	}
})

// globals
// const __SORTED_ID__ = []
// // const 
