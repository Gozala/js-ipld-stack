// @flow strict

const { promisify } = require("util")
const CID = require("./cids")
const multihashing = promisify(require("multihashing-async"))
const getCodec = require("./get-codec")

/*::
import type { Format, BinaryEncoded, Algorithm, Codec, BlockReader} from "./codec-interface.js"
type Accessor<a> = { get():a; set(a):void };

export type BlockState<a> =
  | { source: a, data: ?BinaryEncoded<a>, cid:?CID<a>, codec: Format, algo: Algorithm }
  | { source: ?a, data: BinaryEncoded<a>, cid:?CID<a>, codec: Format, algo: Algorithm }
  | { source: ?a, data: BinaryEncoded<a>, cid:CID<a>, codec: ?Format, algo: ?Algorithm }
*/

const readonly = /*::<a>*/ (value /*:a*/) /*:Accessor<a>*/ => ({
  get: () => value,
  set: () => {
    throw new Error("Cannot set read-only property")
  }
})

class Block /*::<a>*/ {
  /*::
  opts:BlockState<a>
  */
  constructor(opts /*:BlockState<a>*/) {
    if (!opts) throw new Error("Block options are required")
    if (!opts.source && !opts.data) {
      throw new Error(
        "Block instances must be created with either an encode source or data"
      )
    }
    if (opts.source && !opts.codec) {
      throw new Error(
        "Block instances created from source objects must include desired codec"
      )
    }
    if (opts.data && !opts.cid && !opts.codec) {
      throw new Error(
        "Block instances created from data must include cid or codec"
      )
    }
    if (!opts.cid && !opts.algo) opts.algo = "sha2-256"
    // Do our best to avoid accidental mutations of the options object after instantiation
    // Note: we can't actually freeze the object because we mutate it once per property later

    const accessor /*:any*/ = readonly(Object.assign({}, opts))
    Object.defineProperty(this, "opts", accessor)
  }
  async cid() /*:Promise<CID<a>>*/ {
    const { opts } = this
    if (opts.cid) {
      return opts.cid
    } else {
      let codec = this.codec
      let hash = await multihashing(await this.encode(), opts.algo)
      let cid = new CID(1, codec, hash)
      opts.cid = cid
      return cid
    }
  }
  async encode() {
    if (this.opts.data) {
      return this.opts.data
    } else {
      const source /*:any*/ = this.opts.source
      let codec /*:Codec<a>*/ = await getCodec(this.codec)
      let data = await codec.encode(source)
      this.opts.data = data
      return data
    }
  }
  get codec() /*:Format*/ {
    if (this.opts.cid) return this.opts.cid.codec
    else return this.opts.codec
  }
  async decode() /*:Promise<a>*/ {
    const { opts } = this
    if (opts.source) {
      // See https://github.com/ipld/js-ipld-stack/issues/12
      let codec /*:Codec<a>*/ = await getCodec(this.codec)
      let data = await codec.encode(opts.source)
      let source = await codec.decode(data)
      opts.source = source
      return opts.source
    } else {
      const data /*:any*/ = opts.data
      let codec /*:Codec<a>*/ = await getCodec(this.codec)
      let source = await codec.decode(data)
      opts.source = source
      return opts.source
    }
  }
  async reader() /*:Promise<BlockReader<a>>*/ {
    let codec /*:Codec<a>*/ = await getCodec(this.codec)
    return codec.reader(this)
  }

  static encoder(
    source /*:a*/,
    codec /*:Format*/,
    algo /*:Algorithm*/ = "sha2-256"
  ) /*:Block<a>*/ {
    return new Block({ source, codec, algo, data: null, cid: null })
  }
  static decoder(
    data /*:BinaryEncoded<a>*/,
    codec /*:Format*/,
    algo /*:Algorithm*/ = "sha2-256"
  ) /*:Block<a>*/ {
    return new Block({ data, codec, algo, source: null, cid: null })
  }
  static create(
    data /*:BinaryEncoded<a>*/,
    cid /*:CID<a> | string*/,
    validate /*:boolean*/ = false
  ) /*:Block<a>*/ {
    const id = typeof cid === "string" ? new CID(cid) : cid
    if (validate) {
      console.warn("Validation is not implemented")
    }

    return new Block({ data, cid: id, source: null, algo: null, codec: null })
  }
}
module.exports = Block
