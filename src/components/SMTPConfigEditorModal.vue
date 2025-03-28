<script lang="ts">
import {defineComponent} from 'vue'
import {type SMTPConfig} from "~/src/types/types";

export default defineComponent({
  name: "SMTPConfigEditorModal",
  props: {
    config: {type: Object, required: true},
    configs: {type: Array<any>, required: true},
    isEdited: {type: Boolean, default: false},
  },

  data() {
    return {
      currentConfig: {from: {}, ...this.config} as SMTPConfig
    }
  },

  methods: {
    saveConfig() {
      // @ts-ignore
      const form: HTMLFormElement = this.$refs.form;
      if (!form) {
        return false;
      }
      if (!form.checkValidity()) {
        form.reportValidity()
        return false
      }
      if (this.isEdited) {
        this.configs[this.configs.indexOf(this.config)] = this.currentConfig
      } else {
        this.configs.push(this.currentConfig)
      }
      this.$emit('close')
    },
  },

})
</script>

<template>
  <form action="" ref="form">
    <div class="modal-card is-large">
      <header class="modal-card-head">
        <p class="modal-card-title">SMTP Config</p>
        <button
            type="button"
            class="delete"
            @click="$emit('close')"/>
      </header>
      <section class="modal-card-body">

        <b-field grouped>
          <b-field label="Host" label-position="on-border" expanded>
            <b-input icon="server" v-model="currentConfig.host" required/>
          </b-field>

          <b-field label="Port" label-position="on-border" class="port-field is-flex-shrink-4">
            <b-input icon="numeric" v-model="currentConfig.port" type="number" required/>
          </b-field>
        </b-field>

        <b-field label="Username" label-position="on-border">
          <b-input icon="account" v-model="currentConfig.user"/>
        </b-field>

        <b-field label="Password" label-position="on-border">
          <b-input icon="lock" v-model="currentConfig.pass" type="password" password-reveal/>
        </b-field>

        <b-field grouped expanded>
          <b-field expanded label="From Name" label-position="on-border">
            <b-input expanded icon="rename" v-model="currentConfig.from.name"/>
          </b-field>
          <b-field expanded label="From Address" label-position="on-border">
            <b-input expanded icon="email" v-model="currentConfig.from.address" type="email" required/>
          </b-field>
        </b-field>

      </section>
      <footer class="modal-card-foot">
        <b-button
            label="Close"
            @click="$emit('close')"/>
        <b-button
            @click="saveConfig"
            :label="isEdited ? 'Save Changes' : 'Add'"
            type="is-primary"/>
      </footer>
    </div>
  </form>
</template>
