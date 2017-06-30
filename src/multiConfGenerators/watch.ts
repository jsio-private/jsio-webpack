import { ConfigFunction, Configurator, MultiConfOptions } from '../multiConf';
import config from '../config';


const buildConfig: ConfigFunction = function(configurator: Configurator, options: MultiConfOptions) {
  configurator.merge({
    devtool: options.devtool || config.devtool,
    watch: true,
    output: {
      pathinfo: true
    }
  });
};

export default buildConfig;
