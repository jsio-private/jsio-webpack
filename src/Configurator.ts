import path from 'path';
import _ from 'lodash';
import debug from 'debug';
import globToRegExp from 'glob-to-regexp';
import {
  Configuration,
  Rule,
  NewLoaderRule,
  NewUseRule,
  NewResolve,
  NewResolveLoader,
  NewModule,
  Plugin,
  Condition
} from 'webpack';


export interface WebpackConfig extends Configuration {
  resolve?: NewResolve;
  resolveLoader?: NewResolveLoader;
  module?: NewModule;
}


type PluginDefinition = {
  name: string;
  pluginConstructor: new (...args: any[]) => Plugin;
  params?: any[];
};


type NewRule = NewLoaderRule|NewUseRule;


type RuleDefinition = {
  name: string;
  rule: NewRule;
};


export const GLOB_IDENTIFIER: string = 'glob:';


export default class Configurator {
  private log: Function;
  public config: WebpackConfig;
  private pluginDefinitions: { [key: string]: PluginDefinition; };
  private ruleDefinitions: { [key: string]: RuleDefinition; };

  constructor() {
    this.log = debug('jsio-webpack:Configurator');
    this.config = {};
    this.pluginDefinitions = {};
    this.ruleDefinitions = {};
  }

  public merge(
    conf: WebpackConfig|((current: WebpackConfig) => WebpackConfig)
  ): void {
    this.log('merge:', typeof conf === 'function' ? `function: ${conf.name}` : conf);
    if (typeof conf === 'function') {
      const newConfig: WebpackConfig = conf(this.config);
      if (!newConfig) {
        throw new Error('Config function must return a webpack Configuration object');
      }
      this.config = newConfig;
    } else {
      _.merge(this.config, conf);
    }
  }

  private getRules(): Rule[] {
    if (!this.config.module) {
      this.config.module = {
        rules: []
      };
    }
    if (!this.config.module.rules) {
      this.config.module.rules = [];
    }
    return this.config.module.rules;
  }

  public loader(
    name: string,
    rule: NewRule
  ): void {
    this.log('loader:', name, rule);
    this.ruleDefinitions[name] = {
      name: name,
      rule: rule
    };
  }

  public modifyLoader(
    name: string,
    fn: (current: NewRule) => NewRule
  ): void {
    this.log('modifyLoader:', name);
    const ruleDefinition: RuleDefinition = this.ruleDefinitions[name];
    const newRule: NewRule = fn(ruleDefinition.rule);
    this.log('> newRule=', newRule);
    if (!newRule) {
      return;
    }
    ruleDefinition.rule = newRule;
  }

  public removeLoader(name: string): void {
    this.log('removeLoader:', name);
    delete this.ruleDefinitions[name];
  }

  /** Any string Condition will be interpreted as a relative glob from the project directory. */
  public addLoaderInclude(name: string, items: Condition): void;
  public addLoaderInclude(
    name: string,
    items: Condition[]
  ): void {
    const pwd = path.resolve(process.cwd());
    if (!Array.isArray(items)) {
      items = [items];
    }
    this.modifyLoader(name, (existing) => {
      if (!existing.include) {
        existing.include = [];
      } else if (!Array.isArray(existing.include)) {
        existing.include = [existing.include];
      }
      for (let i = 0; i < items.length; i++) {
        let item: Condition = items[i];
        // Interpret strings as globs relative to project directory
        if (typeof item === 'string' && item.indexOf(GLOB_IDENTIFIER) === 0) {
          item = globToRegExp(
            pwd + path.sep + item.substring(GLOB_IDENTIFIER.length),
            { globstar: true }
          );
        }
        existing.include.push(item);
      }
      return existing;
    });
  }

  public plugin(
    name: string,
    pluginConstructor: Function,
    pluginParams?: any[]
  ): void {
    if (this.pluginDefinitions[name]) {
      throw new Error(`Plugin definition collision for name "${name}"`);
    }
    this.pluginDefinitions[name] = {
      pluginConstructor: <any>pluginConstructor,
      name: name,
      params: pluginParams
    };
  }

  public removePlugin(name: string): void {
    this.log('removePlugin:', name);
    delete this.pluginDefinitions[name];
  }

  public resolve(): WebpackConfig {
    this.log('resolve');
    this.log('> Building plugin instances');
    this.config.plugins = [];
    _.forEach(this.pluginDefinitions, (pluginDefinition: PluginDefinition, name: string) => {
      this.log('> creating new plugin instance:', name);
      this.log('> > constructor: ', pluginDefinition.pluginConstructor.name);
      const plugin: Plugin = new pluginDefinition.pluginConstructor(...pluginDefinition.params);
      this.config.plugins.push(plugin);
    });
    this.log('> Building rules');
    const rules: Rule[] = this.getRules();
    _.forEach(this.ruleDefinitions, (ruleDefinition: RuleDefinition) => {
      rules.push(ruleDefinition.rule);
    })
    return this.config;
  }
}
