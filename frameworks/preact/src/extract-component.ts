import type { Component } from "@previewjs/core";
import {
  extractCsf3Stories,
  extractDefaultComponent,
  resolveComponent,
} from "@previewjs/csf3";
import { helpers, TypeResolver } from "@previewjs/type-analyzer";
import ts from "typescript";