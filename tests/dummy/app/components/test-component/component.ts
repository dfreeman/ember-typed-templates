import Component from '@ember/component';
import layout from './template';

export default class TestComponent extends Component {
  layout = layout;

  greeting = 'hello';
  // target = 'world';
};
