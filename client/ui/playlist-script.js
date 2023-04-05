
  Vue.component("playlist", {
    //template: "#playlist-template",
    template: `
    <ul>
        <li
        class="guibtn"
        v-for="(item, index) in items"
        :key="item.id"
        :draggable="true"
        @dragstart="dragStart(index)"
        @dragover="dragOver(index)"
        @drop="drop(index)"
        @dragend="dragEnd"
        @click="onClick"
        >
        {{ item.name }}
        </li>
    </ul>

    `,
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
        console.log("drag start")
      },
      dragOver(index) {
        console.log("dragover")
        if (index !== this.dragging) {
          const items = [...this.items];
          const draggingItem = items[this.dragging];
          items.splice(this.dragging, 1);
          items.splice(index, 0, draggingItem);
          this.items = items;
          this.dragging = index;
        }
      },
      drop(index) {
        console.log("dragover")
        this.dragOver(index);
      },
      dragEnd() {
        console.log("dragover")
        this.dragging = null;
      },
      onClick() {
        console.log("hello world")
      }
    },
  });