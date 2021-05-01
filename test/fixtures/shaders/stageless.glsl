#version 300 es
precision mediump float;

in vec3 vpos;
out vec4 outColor;

void main() {
  outColor = vec4(vpos, 1.0);
}