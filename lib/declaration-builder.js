'use strict';

const Scope = require('./generation/scope');
const TypeResolution = require('./generation/type-resolution');
const { determineName } = require('./utils/hacky-path-analysis');
const syntax = require('@glimmer/syntax');

module.exports = class DeclarationBuilder {
  constructor(modulePrefix, filePath) {
    this.modulePrefix = modulePrefix;
    this.name = determineName(filePath.substring(modulePrefix.length + 1));

    this.stackNodes = new WeakMap();
    this.stack = [
      new Scope('root', {
        locals: '{}',
        components: 'ComponentRegistry',
        helpers: 'HelperRegistry',
        host: 'host'
      })
    ];
  }

  process(content) {
    syntax.traverse(syntax.preprocess(content), this._makeVisitor());
  }

  get scope() {
    return this.stack[this.stack.length - 1];
  }

  serialize() {
    return this.scope.serialize({
      name: this.name,
      modulePrefix: this.modulePrefix
    });
  }

  _makeVisitor() {
    return {
      MustacheStatement: node => this._visitMustacheStatement(node),
      BlockStatement: {
        enter: node => this._enterBlockStatement(node),
        exit: node => this._exitBlockStatement(node)
      }
    };
  }

  _visitMustacheStatement(node) {
    let path = node.path;
    for (let param of node.params) {
      if (param.type === 'PathExpression' && param.parts.length === 1) {
        let ref = this.scope.resolve(param.original, TypeResolution.Local | TypeResolution.Property);
        this.scope.assertExists(`Unable to resolve '${param.original}'`, param.loc.start, ref);
      } else {
        // TODO deal with other stuff, I guess
      }
    }

    if (path.parts.length === 1) {
      if (keywords.includes(path.original)) {
        return;
      }

      let hasArgs = node.hash.pairs.length || node.params.length;
      let types = this._applicableTypesFor(path.original, hasArgs);
      let ref = this.scope.resolve(path.original, types);
      let loc = { line: node.loc.start.line, column: node.loc.start.column + 2 };
      this.scope.assertExists(`Unable to resolve {{${path.original}}}`, loc, ref);
    } else {
      // TODO handle dotted paths
    }
  }

  _applicableTypesFor(identifier, hasArgs = false) {
    let hasDash = identifier.indexOf('-') !== -1;
    let types = 0;
    for (let [condition, type] of [
      [hasDash || !hasArgs, TypeResolution.Local],
      [hasDash, TypeResolution.Component],
      [true, TypeResolution.Helper],
      [!hasArgs, TypeResolution.Property]
    ]) {
      if (condition) {
        types |= type;
      }
    }
    return types;
  }

  _enterBlockStatement(node) {
    let path = node.path;
    if (path.parts.length === 1) {
      if (keywords.includes(path.original)) return;

      let ref = this.scope.resolve(path.original, TypeResolution.Local | TypeResolution.Component);
      let loc = { line: node.loc.start.line, column: node.loc.start.column + 3 };
      // TODO stricter assertions
      this.scope.assertExists(`Unable to resolve {{#${path.original}}}`, loc, ref);

      let locals = {};
      for (let [index, param] of node.program.blockParams.entries()) {
        this.scope.assertHasBlockParam(`Unable to resolve block param '${param}'`, node.loc.start, ref, index);
        locals[param] = this.scope.resolveBlockParam(ref, index);
      }

      let childScope = this.scope.createChild(path.original, locals);
      this.stackNodes.set(node, childScope);
      this.stack.push(childScope);
    } else {
      // TODO handle dotted paths
    }
  }

  _exitBlockStatement(node) {
    let maybeScope = this.stackNodes.get(node);
    if (maybeScope === this.scope) {
      this.stack.pop();
    }
  }
};

const keywords = ['yield', 'outlet', 'each', 'if'];

// {{#foo-bar}}
// local -> component

// {{foo-bar}}
// local -> component -> helper -> property

// {{foo-bar 'baz'}}
// local -> component -> helper

// {{foo}}
// local -> helper -> property

// {{foo 'bar'}}
// helper

// {{foo.bar 'baz'}}
// local
