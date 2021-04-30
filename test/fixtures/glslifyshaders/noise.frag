#version 300 es
precision mediump float;

#pragma glslify: snoise3 = require('glsl-noise/simplex/3d')

in vec3 vpos;
out vec4 outColor;

void main () {
  outColor = vec4(vec3(snoise3(vpos*25.0)), 1.0);
}
