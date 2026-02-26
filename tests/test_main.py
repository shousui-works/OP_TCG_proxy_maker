from main import main


def test_main(capsys):
    main()
    captured = capsys.readouterr()
    assert "Hello from op-tcg-proxy-maker!" in captured.out
