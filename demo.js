const target = {
  message1: "hello",
  message2: "everyone"
};

const handler2 = {
  get: function(target, prop, receiver) {
    console.log('exec')
    return "world";
  }
};

const proxy2 = new Proxy(target, handler2);

console.log(target.message1)
