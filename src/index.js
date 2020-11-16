const fs = require('fs')
const fse = require('fs-extra')

const sourceDic = 'D:/work/JianYou/client'
const root = __dirname + '/../'
const dist = root + '/dist'

init()

async function init () {

//    await fse.emptyDir(dist)
//   console.log('clean dist finished')

  if (!fs.existsSync(dist + '/package.json')) {
    console.log('copy vue-cli structure to dist...')
    await fse.copy(root + '/vue-cli/basic', dist)
    console.log('copy vue-cli structure to dist finished')
  }

  await fse.copy(sourceDic + '/img', dist + '/src/assets')
  console.log('copy img files into dist finished')
  const appConf = JSON.parse(fs.readFileSync(sourceDic + '/app.json', 'utf8'))

  parseRouter(appConf)

  // fs.writeFileSync(dist + '/index.html', getHtmlTemplate(appConf))
}

function parseRouter (appConf) {


  const list = [];
  try {
    appConf.pages.forEach(async (pageStr) => {
      const routerNameArr = pageStr.split('/')

        const dicPath = `${ dist }/src/views/${ routerNameArr[1] }`
        if (!fs.existsSync(dicPath)) {
          fs.mkdirSync(dicPath)
        }

        fs.writeFileSync(`${ dicPath }/${ routerNameArr[2] }.vue`, await generateVueHtml(pageStr))

        const jsonFile = JSON.parse(fs.readFileSync(`${ sourceDic }/${ pageStr }.json`, 'utf8'))
//        console.log(file)
        list.push({
          path: routerNameArr[1] + '/' + routerNameArr[2] + '.vue',
        })

  //    const fileName = sourceDic + '/' + pageStr
  //    const styleFile =  fs.readFileSync(fileName + '.wxss', 'utf8')

    })

    setTimeout(() => {
      fs.writeFileSync(`${ dist }/src/router/index.js`, generateRouter(list))
    },0)

  } catch (e) {
    console.log(e)
  }

}

async function generateVueHtml (pageStr) {
  let html = ''
  try {
    html = `
      <template>
        ${ parseHtml(await fs.readFileSync(sourceDic + '/' + pageStr + '.wxml', 'utf8')) }
      </template>

      <script>
        ${ parseScript(await fs.readFileSync(sourceDic + '/' + pageStr + '.js', 'utf8'), pageStr) }
      </script>

      <style>
        ${ parseStyle(await fs.readFileSync(sourceDic + '/' + pageStr + '.wxss', 'utf8')) }
      </style>
    `
  } catch (e) {
    console.log(e)
  }
  return html
}

function generateRouter (routerList) {
  let routerStr = ''
  routerList.forEach((item) => {
    routerStr += JSON.stringify({
      path: '/' + item.path,
      component: `() => import('../views/${ item.path }')`
    }) + ','
  })


  return `
    import Vue from 'vue'
    import VueRouter from 'vue-router'

    Vue.use(VueRouter)

    const routes = [
      ${ routerStr }
    ]

    const router = new VueRouter({
      mode: 'history',
      base: process.env.BASE_URL,
      routes
    })

    export default router

  `;
}

function parseStyle (str) {
  return str.replace(/rpx/g, 'px')
}

function parseHtml (html) {
  return html
}

function parseScript (script, pageStr) {
  const pageArr = pageStr.split('/')
  function handleRequire (path) {
    fse.copy(`${ sourceDic }/${ pageStr }/../${ path }`, `${ dist }/src/views/${ pageArr[1] }/${pageArr[2]}.vue/../${path}`)
  }

  function handleScript (obj) {
    const hookHandle = {
      data (obj) {
        return JSON.stringify(obj.data)
      },
      mixins () {

      },
      onLoad () {

      },
      onShow () {

      },
    }

    let methodsStr = '{'
    Object.keys(obj).forEach((key) => {
      if (hookHandle[key]) {
        return
      }

      let contentStr = obj[key].toString()
      if (contentStr.startsWith(key)) {
        contentStr = contentStr.replace(key, 'function')
      }
      methodsStr += `${key}: ${ contentStr },`
    })

    methodsStr += '},'
    return `
       export default {
         data () {
           return ${ hookHandle.data(obj) }
         },
         methods: ${ methodsStr }
       }
     `
  }

  const scriptHandlerStr = `
    function Page (obj) {
      return handleScript(obj)
    }
    
    function getApp () {
      return {
        globalData: '',
      }
    }
    
    function require (path) {
      handleRequire(path)
    }
    
  `

  return eval(script + scriptHandlerStr)


  // return `
  //   export default {
  //     data () {
  //       return ${ JSON.stringify(scriptObj.data) }
  //     }
  //   }
  // `
}



