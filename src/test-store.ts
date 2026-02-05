import { useStore } from './store/useStore';
import { type CanvasElement } from './types';

// Mock element
const el: CanvasElement = {
  id: '1',
  type: 'text',
  x: 10,
  y: 10,
  isDynamic: false,
  content: 'Hello'
};

const store = useStore.getState();
console.log('Initial Header Height:', store.header.height);

useStore.getState().addElement('header', el);
const elementsAfterAdd = useStore.getState().header.elements;
console.log('After adding element:', elementsAfterAdd.length === 1 && elementsAfterAdd[0].content === 'Hello' ? 'PASS' : 'FAIL');

useStore.getState().updateElement('header', '1', { x: 20 });
const elementAfterUpdate = useStore.getState().header.elements[0];
console.log('After updating element:', elementAfterUpdate.x === 20 ? 'PASS' : 'FAIL');

useStore.getState().removeElement('header', '1');
const elementsAfterRemove = useStore.getState().header.elements;
console.log('After removing element:', elementsAfterRemove.length === 0 ? 'PASS' : 'FAIL');
