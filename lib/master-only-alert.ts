import { Alert } from "react-native";

/** 우아팬클럽(observer)이 마스터 전용 기능을 눌렀을 때 */
export function alertMasterOnlyFeature() {
  Alert.alert("권한 안내", "우아마스터만 해당 기능을 활용할 수 있습니다.");
}
