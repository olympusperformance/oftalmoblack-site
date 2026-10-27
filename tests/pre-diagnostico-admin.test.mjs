import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {emptyProfile} from '../supabase/functions/_shared/member-profile-model.mjs';
test("troca de mentorado durante recarga da emissão não exibe link do anterior", async () => {
  const A = "00000000-0000-4000-8000-000000000001",
    B = "00000000-0000-4000-8000-000000000002";
  class Elem {
    constructor() {
      this.value = "";
      this.hidden = false;
      this.handlers = {};
      this.children = [];
    }
    addEventListener(t, f) {
      this.handlers[t] = f;
    }
    append(...ns) {
      this.children.push(...ns);
      if (this === nodes["#member"] && !this.value) this.value = ns[0].value;
    }
    replaceChildren(...ns) {
      this.children = ns;
    }
  }
  const nodes = Object.fromEntries(
    [
      "#member",
      "#message",
      "#new-link",
      "#issue",
      "#identity",
      "#sources",
      "#profile",
      "#links",
      "#link",
      "#copy",
      "#reload",
      "#workspace",
    ].map((k) => [k, new Elem()]),
  );
  let blockNextA = false,
    release,
    entered;
  const gate = new Promise((r) => (release = r)),
    started = new Promise((r) => (entered = r));
  function query(table) {
    let id;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        id = v;
        return q;
      },
      single() {
        return q;
      },
      order() {
        return q;
      },
      then(resolve, reject) {
        (async () => {
          if (table === "members" && !id)
            return {
              data: [
                { id: A, nome: "Pessoa A" },
                { id: B, nome: "Pessoa B" },
              ],
            };
          if (table === "members") {
            if (blockNextA && id === A) {
              blockNextA = false;
              entered();
              await gate;
            }
            return {
              data: {
                id,
                nome: id === A ? "Pessoa A" : "Pessoa B",
                email: "fixture",
              },
            };
          }
          return { data: [] };
        })().then(resolve, reject);
      },
    };
    return q;
  }
  const sandbox = {
    URLSearchParams,
    document: {
      querySelector: (s) => nodes[s],
      createElement: () => new Elem(),
    },
    location: { origin: "https://oftalmoblack.com.br", search: "" },
    history: { replaceState() {} },
    window: {
      Club: {
        auth: { require: async () => ({}) },
        sb: {
          from: query,
          auth: {
            getSession: async () => ({
              data: { session: { access_token: "fixture" } },
            }),
          },
        },
        cfg: {
          supabaseUrl: "https://fixture.invalid",
          supabaseAnonKey: "fixture",
        },
      },
    },
    renderMemberProfile() {},
    formatSourceDate:()=> 'Data fixture',
    fetch: async (url,options) => {
      const body=JSON.parse(options.body);
      if(url.endsWith('/member-profile')) {
        if(blockNextA && body.member_id===A){blockNextA=false;entered();await gate;}
        return {ok:true,json:async()=>emptyProfile({id:body.member_id,nome:body.member_id===A?'Pessoa A':'Pessoa B',ativo:true})};
      }
      return {ok:true,json:async()=>({ok:true,token:'a'.repeat(64)})};
    },
  };
  const code = (
    await readFile(
      new URL("../public/assets/admin-perfis.js", import.meta.url),
      "utf8",
    )
  )
    .split("\n")
    .slice(1)
    .join("\n");
  await vm.runInNewContext("(async()=>{" + code + "})()", sandbox);
  blockNextA = true;
  const issuing = nodes["#issue"].handlers.click();
  await started;
  nodes["#member"].value = B;
  nodes["#member"].handlers.change();
  await new Promise(setImmediate);
  release();
  await issuing;
  assert.equal(
    nodes["#identity"].children[0].children[0].textContent,
    "Pessoa B",
  );
  assert.equal(nodes["#new-link"].hidden, true);
  assert.equal(nodes["#link"].value, "");
  await nodes["#issue"].handlers.click();
  assert.equal(nodes["#new-link"].hidden, false);
  assert.match(nodes["#link"].value, /#t=a{64}$/);
});
