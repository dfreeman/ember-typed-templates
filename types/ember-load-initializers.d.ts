declare module 'ember-load-initializers' {
  import Application from '@ember/application';
  export default function loadInitializers(app: typeof Application, modulePrefix: string): void;
}
