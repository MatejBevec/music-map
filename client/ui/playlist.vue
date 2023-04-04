<template>
  <ul>
    <li
      v-for="(item, index) in items"
      :key="item.id"
      :draggable="true"
      @dragstart="dragStart(index)"
      @dragover="dragOver(index)"
      @drop="drop(index)"
      @dragend="dragEnd"
    >
      {{ item.name }}
    </li>
  </ul>
</template>

<script>
export default {
  data() {
    return {
      items: [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
        { id: 3, name: "Item 3" },
        { id: 4, name: "Item 4" },
        { id: 5, name: "Item 5" },
      ],
      dragging: null,
    };
  },
  methods: {
    dragStart(index) {
      this.dragging = index;
    },
    dragOver(index) {
      if (this.dragging === null || this.dragging === index) {
        return;
      }
      const items = [...this.items];
      const draggingItem = items[this.dragging];
      items.splice(this.dragging, 1);
      items.splice(index, 0, draggingItem);
      this.items = items;
      this.dragging = index;
    },
    drop(index) {
      this.dragOver(index);
    },
    dragEnd() {
      this.dragging = null;
    },
  },
};
</script>