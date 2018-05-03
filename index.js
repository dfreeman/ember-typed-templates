'use strict';

const fs = require('fs-extra');
const Filter = require('broccoli-persistent-filter');
const Writer = require('broccoli-caching-writer');
const Funnel = require('broccoli-funnel');
const syntax = require('@glimmer/syntax');
const { stripIndent } = require('common-tags');
const inflector = require('inflected');

module.exports = {
  name: 'ember-typed-templates',

  setupTypeGeneratorRegistry(type, registry) {
    if (type !== 'parent') return;

    let generators = registry._generators;
    let existing = generators.find(gen => gen.name === 'template-type-generator');
    generators.splice(generators.indexOf(existing), 1);

    registry.add({
      name: 'type-registry-generator',
      toTree: (type, tree) => new RegistryWriter(tree, { project: this.project, type })
    });

    registry.add({
      name: 'template-type-generator',
      toTree: (type, tree) => {
        let types = new TemplateTypeGenerator(tree, { project: this.project, type });
        return new Funnel(types, { include: ['**/*.d.ts'] });
      }
    });
  }
};

class RegistryWriter extends Writer {
  constructor(tree, options) {
    super([tree]);
    this.project = options.project;
    this.type = options.type;
  }

  build() {
    if (this.type !== 'app' && this.type !== 'addon') return;

    let registries = {
      component: { name: 'ComponentRegistry', items: [] },
      template: { name: 'TemplateRegistry', items: [] },
      controller: { name: 'ControllerRegistry', items: [] },
      helper: { name: 'HelperRegistry', items: [] }
    };

    for (let absoluteFile of this.listFiles()) {
      let file = absoluteFile.substring(this.inputPaths[0].length + 1);
      let type = determineType(file);
      if (type) {
        let name = determineName(file);
        let dashedName = `${name.replace(/\//g, '-')}-${type}`;
        let importName = inflector.classify(inflector.underscore(dashedName));
        registries[type].items.push({ file, name, importName });
      }
    }

    let output = Object.keys(registries).map(key => this.buildRegistryString(registries[key]));
    fs.writeFileSync(`${this.outputPath}/type-registries.d.ts`, output.join('\n\n'));
  }

  modulePrefix() {
    if (this.type === 'app' && this.project.isEmberCLIAddon()) {
      return 'dummy';
    } else {
      return this.project.name();
    }
  }

  buildRegistryString({ name, items }) {
    let modulePrefix = this.modulePrefix();
    let imports = [];
    let entries = [];
    for (let item of items) {
      let importPath = item.file.replace(/\.\w+$/, '');
      imports.push(`import ${item.importName} from '${modulePrefix}/${importPath}';`);
      entries.push(`'${item.name}': ${item.importName};`);
    }

    return stripIndent`
      ${imports.join('\n      ')}

      export interface ${name} {
        ${entries.join('\n        ')}
      }
    `;
  }
}

class TemplateTypeGenerator extends Filter {
  constructor(tree, options) {
    super(tree, {
      extensions: ['hbs'],
      targetExtension: ['d.ts']
    });

    this.project = options.project;
    this.type = options.type;
  }

  processString(content, relativePath) {
    let name = determineName(relativePath);
    let builder = new DeclarationBuilder(this.project, this.type, name);
    syntax.traverse(syntax.preprocess(content), builder.makeVisitor());
    return builder.serialize();
  }
}

function determineType(relativePath) {
  if (!/\.(hbs|ts)/.test(relativePath)) return;

  let podName = /\/(template|component|controller|helper)\.(?:hbs|ts)$/.exec(relativePath);
  if (podName) {
    return podName[1];
  }

  let grouping = /(?:^|\/)(template|component|controller|helper)s\//.exec(relativePath);
  if (grouping) {
    return grouping[1];
  }
}

function determineName(relativePath) {
  return relativePath
    .replace(/(^|\/)(templates\/components|templates|components|controllers|helpers)(?:\/)/g, '$1')
    .replace(/\.(hbs|ts)$/, '')
    .replace(/\/(template|component|controller|helper)$/, '');
}

const Scope = require('./lib/generation/scope');
const TypeResolution = require('./lib/generation/type-resolution');

class DeclarationBuilder {
  constructor(project, type, name) {
    this.project = project;
    this.type = type;
    this.name = name;

    this.stackNodes = new WeakMap();
    this.stack = [new Scope('root', {
      locals: '{}',
      components: 'ComponentRegistry',
      helpers: 'HelperRegistry',
      host: 'host'
    })];
  }

  get scope() {
    return this.stack[this.stack.length - 1];
  }

  makeVisitor() {
    return {
      MustacheStatement: node => this.visitMustacheStatement(node),
      BlockStatement: {
        enter: node => this.enterBlockStatement(node),
        exit: node => this.exitBlockStatement(node)
      }
    };
  }

  serialize() {
    return this.scope.serialize({
      name: this.name,
      modulePrefix: this.modulePrefix()
    });
  }

  visitMustacheStatement(node) {
    let path = node.path;
    if (path.parts.length === 1) {
      if (path.original === 'yield') {
        for (let [index, param] of node.params.entries()) {
          if (param.type === 'PathExpression' && param.parts.length === 1) {
            let ref = this.scope.resolve(param.original, TypeResolution.Local | TypeResolution.Property);
            this.scope.assertExists(`Unable to resolve '${param.original}'`, param.loc.start, ref);
            this.scope.recordYield(index, ref);
          } else {
            // TODO deal with other stuff, I guess
          }
        }
      }

      if (keywords.includes(path.original)) {
        return;
      }

      let hasArgs = node.hash.pairs.length || node.params.length;
      let types = this.applicableTypesFor(path.original, hasArgs);
      let ref = this.scope.resolve(path.original, types);
      this.scope.assertExists(`Unable to resolve {{${path.original}}}`, node.loc.start, ref);
    } else {
      // TODO handle dotted paths
    }
  }

  applicableTypesFor(identifier, hasArgs = false) {
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

  enterBlockStatement(node) {
    let path = node.path;
    if (path.parts.length === 1) {
      if (keywords.includes(path.original)) return;

      let ref = this.scope.resolve(path.original, TypeResolution.Local | TypeResolution.Component);
      // TODO stricter assertions
      this.scope.assertExists(`Unable to resolve {{#${path.original}}}`, node.loc.start, ref);

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

  exitBlockStatement(node) {
    let maybeScope = this.stackNodes.get(node);
    if (maybeScope === this.scope) {
      this.stack.pop();
    }
  }

  modulePrefix() {
    if (this.type === 'app' && this.project.isEmberCLIAddon()) {
      return 'dummy';
    } else {
      return this.project.name();
    }
  }
}

const keywords = [
  'yield',
  'outlet',
  'each',
  'if'
];

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
