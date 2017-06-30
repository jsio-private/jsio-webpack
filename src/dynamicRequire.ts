// Hack to get runtime require object... how to dynamic require with webpack build?
const dynamicRequire = eval('require');
export default dynamicRequire;
