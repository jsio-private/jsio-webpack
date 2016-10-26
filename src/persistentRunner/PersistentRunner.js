'use strict';
const assign = require('object-assign');


/**
 * https://github.com/webpack/webpack/blob/master/lib/Compiler.js
 */
class PersistentRunner {
  constructor (compiler, watchOptions, handler) {
    this.startTime = null;
    this.invalid = false;
    this.error = null;
    this.stats = null;
    this.handler = handler;

    this.dirty = true;

    if (typeof watchOptions === 'number') {
      this.watchOptions = {
        aggregateTimeout: watchOptions
      };
    } else if (watchOptions && typeof watchOptions === 'object') {
      this.watchOptions = assign({}, watchOptions);
    } else {
      this.watchOptions = {};
    }
    this.watchOptions.aggregateTimeout = this.watchOptions.aggregateTimeout || 200;
    this.compiler = compiler;

    this.running = true;
    this.compiler.readRecords((err) => {
      if (err) return this._done(err);

      this._go();
    });
  }

  setHandler (handler) {
    if (this.running) {
      throw new Error('Must wait until current compilation finishes');
    }
    this.handler = handler;
  }

  _go () {
    this.startTime = new Date().getTime();
    this.running = true;
    this.invalid = false;
    this.compiler.applyPluginsAsync('watch-run', this, (err) => {
      if (err) return this._done(err);

      const onCompiled = (err, compilation) => {
        if (err) return this._done(err);
        if (this.invalid) return this._done();

        if (this.compiler.applyPluginsBailResult('should-emit', compilation) === false) {
          return this._done(null, compilation);
        }

        this.compiler.emitAssets(compilation, (err) => {
          if (err) return this._done(err);
          if (this.invalid) return this._done();

          this.compiler.emitRecords((err) => {
            if (err) return this._done(err);

            if (compilation.applyPluginsBailResult('need-additional-pass')) {
              compilation.needAdditionalPass = true;

              var stats = compilation.getStats();
              stats.startTime = this.startTime;
              stats.endTime = new Date().getTime();
              this.compiler.applyPlugins('done', stats);

              this.compiler.applyPluginsAsync('additional-pass', (err) => {
                if (err) return this._done(err);
                this.compiler.compile(onCompiled);
              });
              return;
            }
            return this._done(null, compilation);
          });
        });
      }

      this.compiler.compile(onCompiled);
    });
  }

  _done (err, compilation) {
    this.running = false;
    if (this.invalid) return this._go();
    this.error = err || null;
    this.stats = compilation ? compilation.getStats() : null;
    if (this.stats) {
      this.stats.startTime = this.startTime;
      this.stats.endTime = new Date().getTime();
    }
    if (this.stats) {
      this.compiler.applyPlugins('done', this.stats);
    } else {
      this.compiler.applyPlugins('failed', this.error);
    }

    this.handler(this.error, this.stats);
    this.handler = null;

    if (!this.error) {
      this.watch(compilation.fileDependencies, compilation.contextDependencies, compilation.missingDependencies);
    }
  }

  watch (files, dirs, missing) {
    this.watcher = this.compiler.watchFileSystem.watch(
      files, dirs, missing, this.startTime, this.watchOptions,
      (err, filesModified, contextModified, missingModified, fileTimestamps, contextTimestamps) => {
        this.watcher = null;
        if (err) return this.handler(err);

        this.compiler.fileTimestamps = fileTimestamps;
        this.compiler.contextTimestamps = contextTimestamps;
        // this.invalidate();
        this.dirty = true;
      },
      (fileName, changeTime) => {
        this.compiler.applyPlugins('invalid', fileName, changeTime);
      }
    );
  }

  run (cb) {
    if (!this.dirty) {
      cb && cb();
      return false;
    }
    if (this.running) {
      throw new Error('already running');
    }

    this.dirty = false;
    this.setHandler(cb);
    this._go();
  }

  invalidate () {
    if (this.watcher) {
      this.watcher.pause();
      this.watcher = null;
    }
    if (this.running) {
      this.invalid = true;
      return false;
    } else {
      // this._go();
      this.dirty = true;
    }
  }

  close (callback) {
    if (callback === undefined) callback = () => {};

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.running) {
      this.invalid = true;
      this._done = () => {
        callback();
      };
    } else {
      callback();
    }
  }
}


module.exports = PersistentRunner;
