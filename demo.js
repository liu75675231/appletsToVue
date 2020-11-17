let str = "fix-bottom-btn btn-blue  {{'margin-top:'+ navHeight+'px'}} {{'margin-bottom:'+ navHeight+'px'}}"

str = str.replace(/'/g, '')
let classStr = "{"
handle()
function handle () {
  const startIndex = str.indexOf("{{")
  const endIndex = str.indexOf("}}")

  let selected = str.substring(startIndex, endIndex + 2)
  str = str.replace(selected, '')

  selected = selected.replace(/^{{|}}$/g, '').trim()
  console.log(selected)
  if (str.indexOf('{{') > -1) {
    handle()
  }
}


//classStr = classStr.replace(/,$/, '') + '}'

//console.log(classStr)
//console.log(str)
