{
  "targets": [
    {
      "target_name": "bsdiff",
      "sources": [
        "bsdiff/main.cc",
        "bsdiff/bsdiff/bsdiff.c",
        "bsdiff/bzlib/bzlib.c",
        "bsdiff/bzlib/compress.c",
        "bsdiff/bzlib/crctable.c",
        "bsdiff/bzlib/randtable.c",
        "bsdiff/bzlib/blocksort.c",
        "bsdiff/bzlib/huffman.c",
        "bsdiff/bzlib/decompress.c"
      ],
      "defines": [
        "BZ_NO_STDIO"
      ]
    }
  ]
}
