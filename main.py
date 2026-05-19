import cv2  


def main() -> None:  
    cap = cv2.VideoCapture(0)  # 기본 웹캠(인덱스 0) 열기
    if not cap.isOpened():  # 카메라 열기 실패 체크
        raise RuntimeError("카메라를 열지 못했습니다. 웹캠 연결/권한을 확인하세요.")  

    print("카메라 시작: q 키로 종료")  # 종료 안내 출력

    while True:  # 프레임 루프 시작
        ok, frame = cap.read()  # 한 프레임 읽기

        if not ok:  # 프레임 획득 실패
            print("프레임을 읽지 못했습니다.") 
            break  

        frame = cv2.flip(frame, 1)  # 좌우 반전(거울 효과)
        cv2.putText(  # 화면 좌측 위에 상태 텍스트 표시
            frame,  # 대상 프레임
            "camera test - press q to quit",  # 출력 문자열
            (20, 30),  # 텍스트 위치 
            cv2.FONT_HERSHEY_SIMPLEX,  # 폰트
            0.8,  # 폰트 크기
            (0, 255, 0),  # 색상
            2,  # 두께
            cv2.LINE_AA,  # 안티앨리어싱 텍스트부드럽게
        )

        cv2.imshow("Pose Motion Counter", frame)  

        key = cv2.waitKey(1) & 0xFF  # 키 입력 체크
        if key in (ord('q'), 27):  # q 또는 ESC
            break  

    cap.release()  # 카메라 자원 해제
    cv2.destroyAllWindows()  # 창 닫기


if __name__ == "__main__":  # 스크립트 직접 실행 진입점
    main()  # main 실행
