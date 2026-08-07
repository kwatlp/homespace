/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: packages/schema/schemas/*.json
 * Regenerate with: npm run codegen  (in homespace-schema)
 */

/** `schemas/pack.schema.json`, embedded. */
export const packSchema: Readonly<Record<string, unknown>> = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://homespace.dev/schema/pack.schema.json",
  "title": "PackManifest",
  "description": "Contract #1 — a publishable pack: a directory plus this manifest.json. See TDD §3.",
  "type": "object",
  "required": [
    "id",
    "type",
    "title"
  ],
  "additionalProperties": true,
  "properties": {
    "id": {
      "type": "string",
      "description": "Slug; also the pack folder name under content/packs/.",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    },
    "type": {
      "type": "string",
      "enum": [
        "game",
        "app",
        "art",
        "post",
        "link",
        "bundle"
      ]
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "summary": {
      "type": "string",
      "description": "One short sentence."
    },
    "version": {
      "type": "string"
    },
    "entrypoint": {
      "$ref": "#/$defs/PackEntrypoint"
    },
    "media": {
      "$ref": "#/$defs/PackMedia"
    },
    "checksums": {
      "$ref": "#/$defs/Checksums"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "license": {
      "type": "string"
    },
    "created": {
      "type": "string",
      "description": "ISO-8601 timestamp."
    },
    "updated": {
      "type": "string",
      "description": "ISO-8601 timestamp."
    },
    "discussion_url": {
      "type": "string"
    },
    "sandbox": {
      "type": "string",
      "enum": [
        "standard",
        "strict"
      ],
      "default": "standard",
      "description": "Player isolation level for embedded web builds. See TDD §6.4."
    },
    "extra": {
      "type": "object",
      "description": "Freeform escape hatch, passed through to templates untouched.",
      "additionalProperties": true
    }
  },
  "allOf": [
    {
      "description": "game/app must ship a playable or downloadable entrypoint.",
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "enum": [
              "game",
              "app"
            ]
          }
        }
      },
      "then": {
        "required": [
          "entrypoint"
        ],
        "properties": {
          "entrypoint": {
            "anyOf": [
              {
                "required": [
                  "web"
                ]
              },
              {
                "required": [
                  "download"
                ]
              }
            ]
          }
        }
      }
    },
    {
      "description": "post must point at a markdown file.",
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "post"
          }
        }
      },
      "then": {
        "required": [
          "entrypoint"
        ],
        "properties": {
          "entrypoint": {
            "required": [
              "post"
            ]
          }
        }
      }
    },
    {
      "description": "link must point at an outbound destination.",
      "if": {
        "required": [
          "type"
        ],
        "properties": {
          "type": {
            "const": "link"
          }
        }
      },
      "then": {
        "required": [
          "entrypoint"
        ],
        "properties": {
          "entrypoint": {
            "required": [
              "link"
            ]
          }
        }
      }
    },
    {
      "description": "Every download entry requires a checksum (scanner verifies with --verify).",
      "if": {
        "required": [
          "entrypoint"
        ],
        "properties": {
          "entrypoint": {
            "required": [
              "download"
            ]
          }
        }
      },
      "then": {
        "required": [
          "checksums"
        ]
      }
    }
  ],
  "$defs": {
    "PackEntrypoint": {
      "type": "object",
      "description": "Only the keys relevant to the pack type are required.",
      "additionalProperties": false,
      "properties": {
        "web": {
          "type": "string",
          "description": "Relative path to an HTML entry (game/app)."
        },
        "download": {
          "type": "string",
          "description": "Relative path to a downloadable file."
        },
        "post": {
          "type": "string",
          "description": "Relative path to a markdown file."
        },
        "link": {
          "type": "string",
          "description": "Outbound URL."
        }
      }
    },
    "PackMedia": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "cover": {
          "type": "string"
        },
        "gallery": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "alt": {
          "type": "object",
          "description": "Map of media path → alt text (accessibility; TDD §5.3).",
          "additionalProperties": {
            "type": "string"
          }
        }
      }
    },
    "Checksums": {
      "type": "object",
      "description": "Map of relative file path → 'sha256:<64 hex>'.",
      "additionalProperties": {
        "type": "string",
        "pattern": "^sha256:[a-f0-9]{64}$"
      }
    }
  }
};

/** `schemas/homespace.schema.json`, embedded. */
export const homespaceSchema: Readonly<Record<string, unknown>> = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://homespace.dev/schema/homespace.schema.json",
  "title": "HomespaceManifest",
  "description": "Contract #2 — the composition layer for a homespace. See TDD §4.",
  "type": "object",
  "required": [
    "name"
  ],
  "additionalProperties": true,
  "properties": {
    "$schema": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "description": "Machine slug.",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    },
    "title": {
      "type": "string",
      "description": "Display name."
    },
    "tagline": {
      "type": "string"
    },
    "lang": {
      "type": "string",
      "default": "en"
    },
    "icon": {
      "type": "string",
      "description": "Browser-tab icon; homespace-relative, resolved like a section's media (TDD §4)."
    },
    "local": {
      "$ref": "#/$defs/LocalAddress"
    },
    "layout": {
      "type": "string",
      "enum": [
        "scroll",
        "pages",
        "grid"
      ],
      "default": "scroll"
    },
    "theme": {
      "$ref": "#/$defs/Theme"
    },
    "nav": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/NavLink"
      }
    },
    "markdown": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "allowHtml": {
          "type": "boolean",
          "default": false,
          "description": "Homespace-level opt-in for raw HTML in post markdown (TDD §6.3)."
        }
      }
    },
    "sections": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/Section"
      }
    },
    "footer": {
      "$ref": "#/$defs/Footer"
    }
  },
  "$defs": {
    "LocalAddress": {
      "type": "object",
      "description": "Local dev/serve address (TDD §7.1).",
      "additionalProperties": false,
      "properties": {
        "host": {
          "type": "string"
        },
        "port": {
          "type": "integer",
          "minimum": 1,
          "maximum": 65535,
          "default": 4321
        },
        "mdns": {
          "type": "boolean",
          "default": false
        }
      }
    },
    "NavLink": {
      "type": "object",
      "required": [
        "label",
        "href"
      ],
      "additionalProperties": false,
      "properties": {
        "label": {
          "type": "string"
        },
        "href": {
          "type": "string"
        }
      }
    },
    "Theme": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "tokens": {
          "$ref": "#/$defs/ThemeTokens"
        },
        "css": {
          "type": "string",
          "description": "Optional custom stylesheet, loaded last."
        }
      }
    },
    "ThemeTokens": {
      "type": "object",
      "description": "Designer-facing variables; additional tokens are allowed.",
      "additionalProperties": true,
      "properties": {
        "color": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          },
          "properties": {
            "bg": {
              "type": "string"
            },
            "surface": {
              "type": "string"
            },
            "text": {
              "type": "string"
            },
            "accent": {
              "type": "string"
            }
          }
        },
        "font": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "body": {
              "type": "string"
            },
            "display": {
              "type": "string"
            },
            "scale": {
              "type": "number"
            }
          }
        },
        "space": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "unit": {
              "type": "number"
            }
          }
        },
        "radius": {
          "type": "number"
        },
        "maxWidth": {
          "type": "number"
        }
      }
    },
    "Footer": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "text": {
          "type": "string"
        },
        "links": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/NavLink"
          }
        }
      }
    },
    "Source": {
      "type": "object",
      "description": "Filter resolved against catalog.json (TDD §4).",
      "additionalProperties": false,
      "properties": {
        "types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "game",
              "app",
              "art",
              "post",
              "link",
              "bundle"
            ]
          }
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "sort": {
          "type": "string",
          "enum": [
            "created",
            "updated",
            "title"
          ]
        },
        "limit": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "Section": {
      "type": "object",
      "description": "One ordered composition block. type selects the renderer module (v0 registry).",
      "required": [
        "type"
      ],
      "additionalProperties": true,
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "hero",
            "links",
            "packs",
            "posts",
            "gallery",
            "embed",
            "html"
          ]
        },
        "title": {
          "type": "string"
        },
        "heading": {
          "type": "string"
        },
        "sub": {
          "type": "string"
        },
        "media": {
          "type": "string"
        },
        "style": {
          "type": "string"
        },
        "rss": {
          "type": "boolean"
        },
        "src": {
          "type": "string"
        },
        "height": {
          "type": "number"
        },
        "file": {
          "type": "string"
        },
        "source": {
          "$ref": "#/$defs/Source"
        }
      },
      "allOf": [
        {
          "description": "embed sections require a src.",
          "if": {
            "properties": {
              "type": {
                "const": "embed"
              }
            }
          },
          "then": {
            "required": [
              "src"
            ]
          }
        },
        {
          "description": "html sections require a file.",
          "if": {
            "properties": {
              "type": {
                "const": "html"
              }
            }
          },
          "then": {
            "required": [
              "file"
            ]
          }
        }
      ]
    }
  }
};

/** `schemas/catalog.schema.json`, embedded. */
export const catalogSchema: Readonly<Record<string, unknown>> = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://homespace.dev/schema/catalog.schema.json",
  "title": "Catalog",
  "description": "Deterministic scanner output: content/ → catalog.json. Consumed by the renderer. See TDD §2, §6. Refined in WO-2.",
  "type": "object",
  "required": [
    "version",
    "packs"
  ],
  "additionalProperties": false,
  "properties": {
    "version": {
      "type": "integer",
      "const": 1,
      "description": "Catalog format version."
    },
    "generated": {
      "type": "string",
      "description": "Optional build stamp (ISO-8601); omitted unless the build ran with --stamp (determinism)."
    },
    "packs": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/CatalogPack"
      }
    }
  },
  "$defs": {
    "CatalogPack": {
      "type": "object",
      "description": "A validated pack manifest plus scanner-derived fields.",
      "required": [
        "id",
        "type",
        "title",
        "slug",
        "dir"
      ],
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": [
            "game",
            "app",
            "art",
            "post",
            "link",
            "bundle"
          ]
        },
        "title": {
          "type": "string"
        },
        "summary": {
          "type": "string"
        },
        "version": {
          "type": "string"
        },
        "slug": {
          "type": "string",
          "description": "URL-safe identifier for detail-page routing (derived from id)."
        },
        "dir": {
          "type": "string",
          "description": "Pack folder path relative to the homespace root, e.g. content/packs/<id>."
        },
        "entrypoint": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "web": {
              "type": "string"
            },
            "download": {
              "type": "string"
            },
            "post": {
              "type": "string"
            },
            "link": {
              "type": "string"
            }
          }
        },
        "media": {
          "type": "object",
          "additionalProperties": true,
          "properties": {
            "cover": {
              "type": "string"
            },
            "gallery": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "alt": {
              "type": "object",
              "additionalProperties": {
                "type": "string"
              }
            }
          }
        },
        "checksums": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "license": {
          "type": "string"
        },
        "created": {
          "type": "string"
        },
        "updated": {
          "type": "string"
        },
        "discussion_url": {
          "type": "string"
        },
        "sandbox": {
          "type": "string",
          "enum": [
            "standard",
            "strict"
          ]
        },
        "extra": {
          "type": "object",
          "additionalProperties": true
        }
      }
    }
  }
};
