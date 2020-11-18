const fs = require('fs')
const fse = require('fs-extra')
const cheerio = require('cheerio')

const CompileJs = require('./compile-js') // 这个类库主要用于把小程序的js文本，转换为vue中script能认的js文本

const sourceDic = 'D:/demo/wx-trans-demo'  // 源目录，就是小程序的根目录
const root = __dirname + '/../'      // 当前生成器的根目录
const dist = root + '/dist'   // 当前生成器项目的dist目录，此文件夹存放dist生成好的vue-cli项目

CompileJs.init(sourceDic, dist)

// 主执行文件，用于启动转换
init()

async function init () {
  // 当使用 yarn index.js --clean-dist清除dist文件夹下生成的内容
  if (process.argv.indexOf('--clean-dist') > -1) {
    await fse.emptyDir(dist)
    console.log('clean dist finished')
  }

  // 把vue-cli下的文件复制到dist中，而dist就是转换后的vue项目
  if (!fs.existsSync(dist + '/package.json')) {
    console.log('copy vue-cli structure to dist...')
    await fse.copy(root + '/vue-cli/basic', dist)
    console.log('copy vue-cli structure to dist finished')
  }

  // 解析app.json文件
  const appConf = JSON.parse(fs.readFileSync(sourceDic + '/app.json', 'utf8'))

  // 吧小程序中的app.js中的代码转换为vue可识别的js代码，并存到/src/wx-app.js中
  fs.writeFileSync(dist + '/src/wx-app.js', CompileJs.parseAppJs(fs.readFileSync(sourceDic + '/app.js', 'utf8')))

  // 解析路由，并把解析好的路由保存到src/router/index.js中，并迭代其中每个路由项，并以此生成对应的vue文件
  parseRouter(appConf)

  // fs.writeFileSync(dist + '/index.html', getHtmlTemplate(appConf))
}

function parseRouter (appConf) {


  const list = [];
  try {
    // 遍历app.json中的pages，并吧其中每个路由地址对应的小程序代码都生成对应的src/views/目录下的vue文件
    appConf.pages.forEach(async (pageStr) => {
      const routerNameArr = pageStr.split('/')

        const dicPath = `${ dist }/src/views/${ routerNameArr[1] }`
        if (!fs.existsSync(dicPath)) {
          fs.mkdirSync(dicPath)
        }

        // 生成vue文件,并存到src/views目录下
        fs.writeFileSync(`${ dicPath }/${ routerNameArr[2] }.vue`, await generateVueHtml(pageStr))

        const jsonFile = JSON.parse(fs.readFileSync(`${ sourceDic }/${ pageStr }.json`, 'utf8'))
//        console.log(file)
        list.push({
          path: routerNameArr[1] + '/' + routerNameArr[2] + '.vue',
        })

  //    const fileName = sourceDic + '/' + pageStr
  //    const styleFile =  fs.readFileSync(fileName + '.wxss', 'utf8')

    })

    // 生成路由文件，并放到src/router/index.js中
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
        ${ CompileJs.parsePageJs(await fs.readFileSync(sourceDic + '/' + pageStr + '.js', 'utf8'), pageStr) }
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
    routerStr += '{path:"/' + item.path.replace(/.vue$/, '') + '", component: () => import("../views/' + item.path + '")},'
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
  html = '<div>' + html + '</div>'
  const $ = cheerio.load(html, { decodeEntities: false })

  var $dom = $.root().find('div')
  parseEachHtml($, $dom)
  return $.root().find('body').html()
}

function parseEachHtml ($, $dom) {
  const dom = $dom.get(0)
  if (dom.tagName === 'block') {
    dom.tagName = 'template'
  }
  if (dom.tagName === 'view') {
    dom.tagName = 'div'
  }
  if (dom.tagName === 'text') {
    dom.tagName = 'span'
  }

  const attrs = getAllAttributes(dom)
//  console.log(attrs)
  attrs.forEach((elem) => {
    if (elem.name === 'wx:else') {
      $dom.removeAttr(elem.name)
      $dom.attr('v-else', '')
      return
    }

    if (elem.name === 'wx:key') {
      $dom.removeAttr(elem.name)
      $dom.attr('v-bind:key', 'item.' + elem.value)
      return
    }

    if (elem.name === 'class') {
      const classObj = handleAndGetClass(elem.value)
      if (classObj.static) {
        $dom.attr('class', classObj.static)
      }

      if (classObj.dynamic) {
        $dom.attr('v-bind:class', classObj.dynamic)
      }

      return
    }

    // style的解析暂时没实现
    if (elem.name === 'style') {
      return
    }
    const val = attrvalHandle(elem.value)
    if (elem.name === 'wx:if') {
      $dom.removeAttr(elem.name)
      $dom.attr('v-if', val)
      return
    }

    if (elem.name === 'bindtap') {
      $dom.removeAttr(elem.name)
      $dom.attr('v-on:click', val)
      return
    }

    if (elem.name === 'wx:for') {
      $dom.removeAttr('wx:for')
      let elemName = 'item'
      if ($dom.attr('wx:for-item')) {
        elemName = $dom.attr('wx:for-item')
        $dom.removeAttr('wx:for-item')
      }

      let elemIndex = 'index'
      if ($dom.attr('wx:for-index')) {
        elemIndex = $dom.attr('wx:for-index')
        $dom.removeAttr('wx:for-index')
      }
      $dom.attr('v-for', '(' + elemName + ', ' + elemIndex + ') in ' + val)

      return
    }

    if (elem.value.indexOf('{{') > -1) {
      $dom.removeAttr(elem.name)
      $dom.attr('v-bind:' + elem.name, val)
    } else {
      $dom.attr(elem.name, val)
    }

  })

  $dom.children().each((index, item) => {
    const $item = $(item)
    parseEachHtml($, $item)
  })
}

function handleAndGetClass (str) {
  if (str.indexOf('{{') === -1) {
    return {
      static: str,
    }
  }
  str = str.replace(/'/g, '')
  let classStr = "{"
  handle()
  function handle () {
    const startIndex = str.indexOf("{{")
    const endIndex = str.indexOf("}}")

    let selected = str.substring(startIndex, endIndex + 2)
    str = str.replace(selected, '')

    selected = selected.replace(/^{{|}}$/g, '').trim()

    if (selected.indexOf('?') > -1 && selected.indexOf(':') > -1) {
      const selectedArr = selected.split(/\?|:/).map((item) => {
        return item.trim()
      })

      if (selectedArr[1] != "") {
        setToClassStr(selectedArr[1], selectedArr[0])
      }
      if (selectedArr[2] != "") {
        setToClassStr(selectedArr[2], '!' + selectedArr[0])
      }
    }
    if (str.indexOf('{{') > -1) {
      handle()
    }
  }

  function setToClassStr (key, val) {
    if (key.indexOf(' ') > -1) {
      key.split(' ').forEach((keyItem) => {
        classStr += "'" + keyItem + "': " + val + ','
      })
    } else {
      classStr += "'" + key + "': " + val + ','
    }
  }

  return {
    static: str.trim(),
    dynamic: classStr.replace(/,$/, '') + '}',
  }
}

function attrvalHandle (val) {
  if (!val) {
    return ''
  }

  const startTokenIndex = val.indexOf('{{')
  const endTokenIndex = val.indexOf('}}')

  if (startTokenIndex === -1 && endTokenIndex === -1) {
    return val
  }

  if (val.startsWith('{{') && val.endsWith('}}')) {
    return val.replace(/^{{|}}$/g, '').trim()
  }



  if (startTokenIndex > -1 && endTokenIndex > -1 && startTokenIndex < endTokenIndex) {
    return parseHtmlAttrTextWithToken(val)
  }
}

function parseHtmlAttrTextWithToken (str) {
  function handle (str) {
    const startIndex = str.indexOf('{{')
    if (startIndex === 0) {
      str = str.replace("{{", "")
    } else {
      str = str.replace("{{", "' + ")
    }

    const endIndex = str.indexOf('}}') + 2
    if (endIndex == str.length) {
      str = str.replace("}}", "")
    } else {
      str = str.replace("}}", " + '")
    }

    if (str.indexOf('}}') > -1 && str.indexOf('{{') > -1) {
      return handle(str)
    }
    return str
  }

  let noStart = true
  if (str.startsWith('{{')) {
    noStart = false
  }
  let noEnd = true
  if (str.endsWith('}}')) {
    noEnd = false
  }
  let parsedStr = handle(str)
  if (noStart) {
    parsedStr = "'" + parsedStr
  }
  if (noEnd) {
    parsedStr += "'"
  }

  return parsedStr
}

function getAllAttributes (node) {
  return node.attributes || Object.keys(node.attribs).map(
    name => ({ name, value: node.attribs[name] })
  )
}



function parseScript (script, pageStr) {
  const pageArr = pageStr.split('/')
  function handleRequire (path) {
    try {
      fse.copySync(`${ sourceDic }/${ pageStr }/../${ path }`, `${ dist }/src/views/${ pageArr[1] }/${pageArr[2]}.vue/../${path}`)
    } catch (e) {
    }

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
      methods () {
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
        return methodsStr
      },
    }


    return `
       export default {
         data () {
           return ${ hookHandle.data(obj) }
         },
         methods: ${ hookHandle.methods() }
       }
     `
  }

  const wx = {
    canIUse () {
      return false
    }
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

}



