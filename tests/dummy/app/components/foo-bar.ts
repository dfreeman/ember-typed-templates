import Component from '@ember/component';
import layout from '../templates/components/foo-bar';

export default class FooBar extends Component {
  layout = layout;
  foo = "hi";
};
