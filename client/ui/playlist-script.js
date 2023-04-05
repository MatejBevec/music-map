
  Vue.component("playlist", {
    //template: "#playlist-template",
    template: `
    <div>
        <div
        :class="{'guibtn': true, 'topbtn': true, 'disabled': this.addMode}"
        @click="onClickJourney"
        >
          {{this.addMode ? "pick destination..." : "journey ↝"}}
        </div>

        <div
        :class="{'guibtn': true, 'topbtn': true}"
        @click="onClickGiro"
        >
          {{"giro ↻"}}
        </div>
    <ul>
        <li
        v-for="(item, index) in items"
        :class="{'guibtn': true, 'selected': item.selected}"
        :key="item.id"
        :draggable="true"
        @dragstart="dragStart(index)"
        @dragover="dragOver(index)"
        @drop="drop(index)"
        @dragend="dragEnd"
        @click="onClick(index)"
        >
        <p>
          <span :style="{color: item.color}">●</span> 
          {{ item.artist }}
        </p>
        <p>{{ item.title }}</p>
        </li>
    </ul>
    </div>
    `,

    created() {
      // Handling communication with globals

      vueEventBus.$on("walk-changed", () => {
        this.items = []
        if (map.walk){
          for (let i in map.walk.indices){
            let ind = map.walk.indices[i]
            let info = map.getLabel(ind)
            let sel = false
            if (ind == map.selected){
              this.selected = ind
              sel = true
            }
            let c = getGenreColor(map, ind)
            let cssColor = `rgb(${c[0]},${c[1]},${c[2]})`
            console.log(cssColor)
            this.items.push({id: i, title: info[0], artist: info[1],
              selected: sel, songInd: ind, color: cssColor})
          }
          console.log(this.items)
        }
        this.addMode = map.addMode

      })


    },

    data() {
      return {
        items: [],
        dragging: null,
        selected: null,
        addMode: false,
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
      onClick(index) {
        let songInd = this.items[index].songInd
        if (map.walk){
          map.walk.moveToInd(songInd)
          vueEventBus.$emit("walk-changed") 
        }
      },
      
      onClickJourney(){
        map.toggleAddMode()
      },

      onClickGiro(){ 
        map.makeWalkGiro()
      },

    },


  });