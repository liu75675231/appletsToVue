const fse = require('fs-extra')
const wx = require('../vue-cli/basic/src/wx')

class CompileJs {

  constructor() {
    this.source = ''
    this.dist = ''
  }
  init (source, dist) {
    this.source = source
    this.dist = dist
  }
  handleAppObj (obj) {
    const hookHandle = this.getHandleHookObj(obj)

    return `
       import wx from './wx'
       export default {
        ${ obj.data ? `data () { return ${ hookHandle.data(obj) } },` : '' }
        ${ obj.globalData ? `globalData: ${ hookHandle.globalData(obj) },` : '' }
        methods: ${ hookHandle.methods() }
       }
     `
  }

  handleRequire (path, pageStr) {
    const pageArr = pageStr.split('/')
    fse.copySync(`${ this.source }/${ pageStr }/../${ path }`, `${ this.dist }/src/views/${ pageArr[1] }/${pageArr[2]}.vue/../${path}`)
  }

  getHandleHookObj (obj) {

    const _this = this
    let reservedMethodObj = {
      setData (data) {
        console.log(data)
        const _this = this
        Object.keys(data).forEach((key) => {
          _this[key] = data[key]
        })
      }
    }

    let handleObj = {
      data (obj) {
        return JSON.stringify(obj.data)
      },
      globalData () {
        return JSON.stringify(obj.globalData)
      },
      mixins () {

      },
      onLoad () {
        if (obj.onLoad) {
          const methodStr = obj.onLoad.toString()
          if (methodStr.startsWith('function')) {
            return methodStr.replace('function', 'created') + ','
          } else {
            return methodStr.replace('onLoad', 'created') + ','
          }
        } else {
          return ''
        }
      },
      onShow () {

      },
      methods () {
        let methodsStr = '{'
        Object.keys(obj).forEach((key) => {
          if (handleObj[key]) {
            return
          }

          methodsStr += _this.getMethodStr(key, obj[key])
        })

        Object.keys(reservedMethodObj).forEach((key) => {
          methodsStr += _this.getMethodStr(key, reservedMethodObj[key])
        })

        methodsStr += '},'
        return methodsStr
      },
    }
    return handleObj
  }

  getMethodStr (key, method) {
    let contentStr = method.toString()
    if (contentStr.startsWith(key)) {
      contentStr = contentStr.replace(key, 'function')
    }
    return `${key}: ${ contentStr },`
  }

  parseAppJs (scriptStr) {
    const _this = this

    const scriptHandlerStr = `
    function App (obj) {
      return _this.handleAppObj(obj)
    }

    function getApp () {
      console.log('getapp')
      return {
        globalData: '',
      }
    }

    function require (path) {
      _this.handleRequire(path, pageStr)
    }
  `
    return eval(scriptStr + scriptHandlerStr)
  }

  formatMethodsStr (str) {

  }

  parsePageJs (scriptStr, pageStr) {
    scriptStr = scriptStr.replace(/this.data/g, 'this')
    const runningScriptStr = scriptStr
    var _this = this



    function handleScript (obj, dependencies) {
      const hookHandle = _this.getHandleHookObj(obj)
      const num = pageStr.split('/').length - 1
      let str = ''
      for (let i = 0; i < num; i++) {
        str += '../'
      }

      let appStr = ''
      if (dependencies.app) {
        appStr = `import app from '${str}wx-app'`
      }

      let dependenciesListStr = ''
      Object.keys(dependencies.___wxDependenciesMapping).forEach((name) => {
        dependenciesListStr += `import ${ name } from '${ dependencies.___wxDependenciesMapping[name] }'`
      })

      return `
       import wx from '${str}wx'
       ${ dependenciesListStr }
       ${ appStr }
       export default {
         data () {
           return ${ hookHandle.data(obj) }
         },
         ${ hookHandle.onLoad(obj) }
         methods: ${ hookHandle.methods() }
       }
     `
    }

    const scriptHandlerStr = `
    function Page (obj) {
      return handleScript(obj, {
        app: typeof app ? true : false,
        ___wxDependenciesMapping,
      })
    }

    function getApp () {      
      return true
    }

    function require (path) {
      const pathIndex = runningScriptStr.indexOf(path)
      const lineStartIndex = runningScriptStr.lastIndexOf("\\n", pathIndex)
      const name = runningScriptStr.substring(lineStartIndex, pathIndex).split('=')[0].split(' ')[1].trim()
      ___wxDependenciesMapping[name] = path
      _this.handleRequire(path, pageStr)
    }
  `

    const prefixDefinition = `
      const ___wxDependenciesMapping = {}
    `

    return eval(prefixDefinition + scriptStr + scriptHandlerStr)

  }
}

module.exports = new CompileJs()
