import test from "node:test";
import assert from "node:assert/strict";
import { fileModel } from "../lib/model/file-model.ts";
import { wellInput, reportInput } from "../lib/model/contracts.ts";

test("curve identity includes file hash, logical file, frame and channel position", () => {
  const channel = { key: "same-key", name: "CBL", units: "mV", dimension: [2, 3], kind: "CBL", calibration: { scale: 1.25 } };
  const frame = { key: "frame", name: "FRAME", indexType: "BOREHOLE-DEPTH", channels: [channel, channel] };
  const source = { logicalFiles: [{ index: 9, id: "LF", origin: { company: "Declared" }, frames: [frame, frame] }, { frames: [frame] }] };
  const before = JSON.stringify(source), result = fileModel("hash-a",source);
  const curves = result.logicalFiles.flatMap(lf => lf.frames.flatMap(frame => frame.curves));
  assert.equal(new Set(curves.map(c => c.id)).size, 6);
  assert.equal(result.logicalFiles[0].logicalFileIndex, 0);
  assert.equal(result.logicalFiles[0].declaredIndex, 9);
  assert.deepEqual(curves[0].dimension,[2,3]);
  assert.equal(curves[0].units,"mV");
  assert.equal(curves[0].metadata.calibration.scale,1.25);
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(fileModel("hash-a",before),result);
  assert.notEqual(fileModel("hash-b",source).logicalFiles[0].id,result.logicalFiles[0].id);
});
test("legacy metadata issues are explicit; gaps do not renumber valid channels", () => {
  for (const source of ["not JSON",null,"{}",{ logicalFiles: {} }]) {
    const result=fileModel("h",source);
    assert.deepEqual(result.issues,["INVALID_METADATA"]);
    assert.deepEqual(result.logicalFiles,[]);
  }
  const result=fileModel("h",{logicalFiles:[null,{frames:[{channels:[null,{name:"X", dimension:[0]}]}]}]});
  assert.equal(result.logicalFiles[0].logicalFileIndex,1);
  assert.equal(result.logicalFiles[0].frames[0].curves[0].channelIndex,1);
  assert.equal(result.logicalFiles[0].frames[0].curves[0].dimension,null);
  assert.equal(result.logicalFiles[0].frames[0].curves[0].units,null);
  assert.equal(result.issues.length,2);
});
test("well and report contracts reject invalid input and injected ownership", () => {
  assert.equal(wellInput.safeParse({name:"  "}).success,false);
  assert.equal(wellInput.safeParse({name:"Well",ownerId:"victim"}).success,false);
  assert.equal(wellInput.parse({name:" Well "}).name,"Well");
  const report={title:"Manual report",analysisId:"a",content:{summary:"Observation",sections:[{heading:"Notes",text:"Raw observations"}]}};
  assert.equal(reportInput.safeParse(report).success,true);
  assert.equal(reportInput.safeParse({...report,analysisId:undefined}).success,false);
  assert.equal(reportInput.safeParse({...report,schemaVersion:99}).success,false);
  assert.equal(reportInput.safeParse({...report,content:{summary:"x",sections:[{heading:"h",text:"x".repeat(20001)}]}}).success,false);
});
