import Vue from 'vue';
import emptyFile from '../../data/emptyFile';
import emptyFolder from '../../data/emptyFolder';

const setter = propertyName => (state, value) => {
  state[propertyName] = value;
};

function debounceAction(action, wait) {
  let timeoutId;
  return (context) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => action(context), wait);
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
const compare = (node1, node2) => collator.compare(node1.item.name, node2.item.name);

class Node {
  constructor(item, isFolder, isRoot) {
    this.item = item;
    this.isFolder = isFolder;
    this.isRoot = isRoot;
    if (isFolder) {
      this.folders = [];
      this.files = [];
    }
  }

  sortChildren() {
    if (this.isFolder) {
      this.folders.sort(compare);
      this.files.sort(compare);
      this.folders.forEach(child => child.sortChildren());
    }
  }
}

const nilFileNode = new Node(emptyFile());
nilFileNode.isNil = true;
const fakeFileNode = new Node(emptyFile());
fakeFileNode.item.id = 'fake';

function getParent(node, getters) {
  if (node.isNil) {
    return nilFileNode;
  }
  return getters.nodeMap[node.item.parentId] || getters.rootNode;
}

function getFolder(node, getters) {
  return node.item.type === 'folder' ?
    node :
    getParent(node, getters);
}

export default {
  namespaced: true,
  state: {
    selectedId: null,
    editingId: null,
    dragSourceId: null,
    dragTargetId: null,
    newChildNode: nilFileNode,
    openNodes: {},
  },
  getters: {
    nodeStructure: (state, getters, rootState, rootGetters) => {
      const nodeMap = {};
      rootGetters['folders/items'].forEach((item) => {
        nodeMap[item.id] = new Node(item, true);
      });
      rootGetters['files/items'].forEach((item) => {
        nodeMap[item.id] = new Node(item);
      });
      const rootNode = new Node(emptyFolder(), true, true);
      Object.keys(nodeMap).forEach((id) => {
        const node = nodeMap[id];
        let parentNode = nodeMap[node.item.parentId];
        if (!parentNode || !parentNode.isFolder) {
          parentNode = rootNode;
        }
        if (node.isFolder) {
          parentNode.folders.push(node);
        } else {
          parentNode.files.push(node);
        }
      });
      rootNode.sortChildren();
      // Add a fake file at the end of the root folder to always allow drag and drop into it.
      rootNode.files.push(fakeFileNode);
      return {
        nodeMap,
        rootNode,
      };
    },
    nodeMap: (state, getters) => getters.nodeStructure.nodeMap,
    rootNode: (state, getters) => getters.nodeStructure.rootNode,
    newChildNodeParent: (state, getters) => getParent(state.newChildNode, getters),
    selectedNode: (state, getters) => getters.nodeMap[state.selectedId] || nilFileNode,
    selectedNodeFolder: (state, getters) => getFolder(getters.selectedNode, getters),
    editingNode: (state, getters) => getters.nodeMap[state.editingId] || nilFileNode,
    dragSourceNode: (state, getters) => getters.nodeMap[state.dragSourceId] || nilFileNode,
    dragTargetNode: (state, getters) => {
      if (state.dragTargetId === 'fake') {
        return fakeFileNode;
      }
      return getters.nodeMap[state.dragTargetId] || nilFileNode;
    },
    dragTargetNodeFolder: (state, getters) => {
      if (state.dragTargetId === 'fake') {
        return getters.rootNode;
      }
      return getFolder(getters.dragTargetNode, getters);
    },
  },
  mutations: {
    setSelectedId: setter('selectedId'),
    setEditingId: setter('editingId'),
    setDragSourceId: setter('dragSourceId'),
    setDragTargetId: setter('dragTargetId'),
    setNewItem(state, item) {
      state.newChildNode = item ? new Node(item, item.type === 'folder') : nilFileNode;
    },
    setNewItemName(state, name) {
      state.newChildNode.item.name = name;
    },
    toggleOpenNode(state, id) {
      Vue.set(state.openNodes, id, !state.openNodes[id]);
    },
  },
  actions: {
    openNode({ state, getters, commit, dispatch }, id) {
      const node = getters.nodeMap[id];
      if (node) {
        if (node.isFolder && !state.openNodes[id]) {
          commit('toggleOpenNode', id);
        }
        dispatch('openNode', node.item.parentId);
      }
    },
    openDragTarget: debounceAction(({ state, dispatch }) => {
      dispatch('openNode', state.dragTargetId);
    }, 1000),
    setDragTarget({ state, getters, commit, dispatch }, id) {
      commit('setDragTargetId', id);
      dispatch('openDragTarget');
    },
  },
};