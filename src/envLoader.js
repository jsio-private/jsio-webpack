'use strict';
const path = require('path');
const fs = require('fs');


const loadEnv = function (envName) {
  console.log('Setting up env for:', envName);
  process.env.NODE_ENV = envName;

  const envFilePath = path.resolve(process.env.PWD, 'envs', process.env.NODE_ENV);
  if (!fs.existsSync(envFilePath)) {
    console.warn('Env file not found:', envFilePath);
    return;
  }

  // Do things
  const data = fs.readFileSync(envFilePath, 'utf-8');
  const lines = data.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.indexOf('#') === 0) {
      continue;
    }
    if (line.indexOf('export ') !== 0) {
      continue;
    }
    const parts = line.match(/export ([a-zA-Z_]+)=(.*)$/);
    if (!parts) {
      console.warn('line didnt match:', line);
      continue;
    }
    const envKey = parts[1];
    let envValue = parts[2];
    // Strip quotes
    envValue = envValue.replace(/^'|'$|^"|"$/g, '');
    console.log(`\t ${envKey} = ${envValue}`);
    process.env[envKey] = envValue;
  }
};


module.exports = {
  loadEnv: loadEnv
};
